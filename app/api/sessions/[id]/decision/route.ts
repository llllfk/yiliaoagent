import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { AuthError, requireSession } from "@/lib/auth";
import { getCaseConfig } from "@/lib/er-think/cases";
import { feedbackFromDelta, recomputeScores } from "@/lib/er-think/scoring";
import { query } from "@/lib/db";
import { safeJsonParse } from "@/lib/utils";
import type { CaseConfig, DecisionNodeId, SessionState } from "@/types";

const NODE_IDS: DecisionNodeId[] = [
  "P1",
  "P2",
  "P3",
  "P4",
  "P5",
  "P6",
  "P7",
  "P8",
];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireSession(["student"]);
    const { id } = await params;
    const body = (await request.json()) as {
      nodeId?: DecisionNodeId;
      reason?: string;
    };

    if (!body.nodeId || !NODE_IDS.includes(body.nodeId)) {
      return fail("无效决策节点");
    }
    const reason = body.reason?.trim() || "";
    if (!reason) return fail("请填写决策理由");

    const result = await query<{
      state: SessionState | string;
      status: string;
      case_code: string;
      case_config: CaseConfig | string;
    }>(
      `SELECT s.state, s.status, c.code AS case_code, c.config AS case_config
       FROM training_sessions s
       JOIN cases c ON c.id = s.case_id
       WHERE s.tenant_id = $1 AND s.id = $2 AND s.user_id = $3
       LIMIT 1`,
      [user.tenantId, id, user.id]
    );
    const row = result.rows[0];
    if (!row || row.status !== "in_progress") return fail("会话不可用", 404);

    let caseConfig = safeJsonParse<CaseConfig>(
      row.case_config,
      row.case_config as CaseConfig
    );
    if (!caseConfig?.qaNodes?.length) {
      caseConfig = getCaseConfig(row.case_code) || caseConfig;
    }

    const before = safeJsonParse<SessionState>(row.state, row.state as SessionState);
    const state: SessionState = {
      ...before,
      decisions: { ...before.decisions },
      examsOrdered: [...before.examsOrdered],
      scoreEvidence: [...before.scoreEvidence],
    };
    state.decisions[body.nodeId] = {
      reason,
      atMinute: state.simMinutes,
    };
    state.simMinutes += 1;

    const scored = recomputeScores(state, caseConfig?.qaNodes || []);
    const feedback = feedbackFromDelta(before, scored);

    await query(
      `UPDATE training_sessions SET state = $1::jsonb, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(scored), id]
    );

    return ok({ feedback, state: scored });
  } catch (error) {
    if (error instanceof AuthError) {
      return fail(error.message, error.status);
    }
    console.error(error);
    return fail("决策提交失败", 500);
  }
}
