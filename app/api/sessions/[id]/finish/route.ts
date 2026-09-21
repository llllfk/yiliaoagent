import { fail, ok } from "@/lib/api";
import { AuthError, requireSession } from "@/lib/auth";
import { getCaseConfig } from "@/lib/er-think/cases";
import { buildDebrief, recomputeScores } from "@/lib/er-think/scoring";
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

    let state = safeJsonParse<SessionState>(row.state, row.state as SessionState);
    state = recomputeScores(state, caseConfig?.qaNodes || []);
    const report = buildDebrief(state);
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
