import { fail, ok } from "@/lib/api";
import { AuthError, requireSession } from "@/lib/auth";
import { getCaseConfig } from "@/lib/er-think/cases";
import { buildDebrief } from "@/lib/er-think/scoring";
import { commitSessionState, normalizeSessionState } from "@/lib/er-think/session-flow";
import { query } from "@/lib/db";
import { safeJsonParse } from "@/lib/utils";
import type { CaseConfig, SessionState } from "@/types";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireSession(["student"]);
    const { id } = await params;

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
    if (!row) return fail("会话不存在", 404);
    if (row.status === "finished") return fail("会话已结束");

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
      return fail("还有未处理的病情变化，请先完成处置再结束演练", 409);
    }

    // 结束前若还有未经历的病情波，把时钟推到下一波并强制处置（贴合「疾病不会一帆风顺」）
    const events = caseConfig?.clinicalEvents || [];
    const handled = new Set(state.eventLog.map((e) => e.eventId));
    const remaining = events
      .filter((e) => !handled.has(e.id))
      .sort((a, b) => a.afterMinute - b.afterMinute);
    if (remaining.length > 0) {
      const nextEv = remaining[0];
      state = {
        ...state,
        simMinutes: Math.max(state.simMinutes, nextEv.afterMinute),
      };
      state = commitSessionState(state, caseConfig);
      await query(
        `UPDATE training_sessions SET state = $1::jsonb, updated_at = NOW() WHERE id = $2`,
        [JSON.stringify(state), id]
      );
      if (state.activeEventId) {
        return fail(
          `病程尚未走完：仍有「${nextEv.title}」等病情变化未处理。请处置后再结束（急诊很少一帆风顺）。`,
          409
        );
      }
    }

    state = commitSessionState(state, caseConfig);
    if (state.activeEventId) {
      await query(
        `UPDATE training_sessions SET state = $1::jsonb, updated_at = NOW() WHERE id = $2`,
        [JSON.stringify(state), id]
      );
      return fail("演练结束前出现新的病情变化，请先处置", 409);
    }

    const report = buildDebrief(state, caseConfig);
    state.branchPath = report.branchPath;
    state.finished = true;

    await query(
      `UPDATE training_sessions
       SET status = 'finished',
           state = $1::jsonb,
           score_total = $2,
           score_detail = $3::jsonb,
           branch_path = $4,
           finished_at = NOW(),
           updated_at = NOW()
       WHERE id = $5 AND tenant_id = $6`,
      [
        JSON.stringify(state),
        report.total,
        JSON.stringify(report),
        state.branchPath,
        id,
        user.tenantId,
      ]
    );

    return ok({ report, state });
  } catch (error) {
    if (error instanceof AuthError) {
      return fail(error.message, error.status);
    }
    console.error(error);
    return fail("结束演练失败", 500);
  }
}
