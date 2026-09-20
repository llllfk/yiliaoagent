import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { AuthError, requireSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { safeJsonParse } from "@/lib/utils";
import type { DecisionNodeId, SessionState } from "@/types";

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

    const result = await query<{ state: SessionState | string; status: string }>(
      `SELECT state, status FROM training_sessions
       WHERE tenant_id = $1 AND id = $2 AND user_id = $3 LIMIT 1`,
      [user.tenantId, id, user.id]
    );
    const row = result.rows[0];
    if (!row || row.status !== "in_progress") return fail("会话不可用", 404);

    const state = safeJsonParse<SessionState>(row.state, row.state as SessionState);
    state.decisions[body.nodeId] = {
      reason,
      atMinute: state.simMinutes,
    };
    state.simMinutes += 1;

    // 框架阶段：仅记录决策；详细加减分在 scoring 引擎迭代
    let feedback = `${body.nodeId} 已记录，理由已保存。`;
    if (body.nodeId === "P1" && /II|2级|二级/i.test(reason)) {
      state.scores.TRI = Math.min(25, state.scores.TRI + 5);
      state.scoreEvidence.push({
        dim: "TRI",
        points: 5,
        rule: "P1 分级正确",
        evidence: reason.slice(0, 120),
      });
      feedback = "分诊方向合理，TRI +5。";
    }
    if (body.nodeId === "P2" && state.decisions.P2!.atMinute <= 10) {
      state.scores.TRI = Math.min(25, state.scores.TRI + 5);
      state.scoreEvidence.push({
        dim: "TRI",
        points: 5,
        rule: "P2 时间窗符合指南",
        evidence: `T+${state.decisions.P2!.atMinute}`,
      });
      feedback = "心电图时间窗达标，TRI +5。";
    }

    await query(
      `UPDATE training_sessions SET state = $1::jsonb, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(state), id]
    );

    return ok({ feedback, state });
  } catch (error) {
    if (error instanceof AuthError) {
      return fail(error.message, error.status);
    }
    console.error(error);
    return fail("决策提交失败", 500);
  }
}
