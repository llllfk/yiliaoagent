import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { AuthError, requireSession } from "@/lib/auth";
import { getCaseConfig } from "@/lib/er-think/cases";
import { commitSessionState, normalizeSessionState } from "@/lib/er-think/session-flow";
import { query } from "@/lib/db";
import { safeJsonParse } from "@/lib/utils";
import type { CaseConfig, SessionState } from "@/types";

/** 推进模拟观察时间，用于触发病情波动链 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireSession(["student"]);
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as { minutes?: number };
    const minutes = Math.min(20, Math.max(1, Number(body.minutes) || 8));

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

    let state = normalizeSessionState(
      safeJsonParse<SessionState>(row.state, row.state as SessionState)
    );
    if (state.activeEventId) {
      return fail("请先处置当前病情变化，再继续观察", 400);
    }

    state = {
      ...state,
      simMinutes: state.simMinutes + minutes,
      chat: [
        ...state.chat,
        {
          role: "system",
          text: `【观察】模拟时钟推进 ${minutes} 分钟（现 T+${state.simMinutes + minutes}）。`,
          at: new Date().toISOString(),
        },
      ],
    };
    state = commitSessionState(state, caseConfig);

    await query(
      `UPDATE training_sessions SET state = $1::jsonb, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(state), id]
    );

    const feedback = state.activeEventId
      ? "观察中出现病情变化，请立即处置。"
      : `已观察 ${minutes} 分钟，暂无新的危急事件。`;

    return ok({ state, feedback });
  } catch (error) {
    if (error instanceof AuthError) {
      return fail(error.message, error.status);
    }
    console.error(error);
    return fail("观察推进失败", 500);
  }
}
