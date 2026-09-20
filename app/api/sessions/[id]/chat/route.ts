import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { AuthError, requireSession } from "@/lib/auth";
import { getCaseConfig } from "@/lib/er-think/cases";
import { matchQaIntent } from "@/lib/er-think/qa-match";
import { query } from "@/lib/db";
import { safeJsonParse } from "@/lib/utils";
import type { CaseConfig, SessionState } from "@/types";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireSession(["student"]);
    const { id } = await params;
    const body = (await request.json()) as { message?: string };
    const message = body.message?.trim() || "";
    if (!message) return fail("请输入问诊内容");

    const result = await query<{
      state: SessionState | string;
      case_code: string;
      case_config: CaseConfig | string;
      status: string;
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

    const state = safeJsonParse<SessionState>(row.state, row.state as SessionState);
    let caseConfig = safeJsonParse<CaseConfig>(
      row.case_config,
      row.case_config as CaseConfig
    );
    if (!caseConfig?.qaNodes?.length) {
      caseConfig = getCaseConfig(row.case_code) as CaseConfig;
    }

    const allAsked = state.unlockedQaIds.length >= caseConfig.qaNodes.length;
    const match = matchQaIntent(
      message,
      caseConfig.qaNodes,
      state.unlockedQaIds,
      allAsked
    );

    state.chat.push({
      role: "student",
      text: message,
      at: new Date().toISOString(),
    });
    state.simMinutes += 1;

    let patientText: string;
    if (match.hit) {
      if (!state.unlockedQaIds.includes(match.node.id)) {
        state.unlockedQaIds.push(match.node.id);
      }
      state.fallbackMissCount = 0;
      patientText = match.node.answer;
    } else {
      state.fallbackMissCount += 1;
      // 前 2 次配合性回答，其后类别引导（附录 A）
      patientText =
        state.fallbackMissCount <= 2
          ? "大夫，我胸口还是疼得厉害……您再问问具体哪儿、怎么个疼法？"
          : match.guide;
    }

    state.chat.push({
      role: "patient",
      text: patientText,
      at: new Date().toISOString(),
    });

    await query(
      `UPDATE training_sessions SET state = $1::jsonb, updated_at = NOW()
       WHERE id = $2 AND tenant_id = $3`,
      [JSON.stringify(state), id, user.tenantId]
    );

    return ok({
      patientResponse: patientText,
      matchedQaId: match.hit ? match.node.id : null,
      state,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return fail(error.message, error.status);
    }
    console.error(error);
    return fail("问诊处理失败", 500);
  }
}
