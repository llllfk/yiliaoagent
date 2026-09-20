import { fail, ok } from "@/lib/api";
import { AuthError, requireSession } from "@/lib/auth";
import { determineBranch, recomputeScores } from "@/lib/er-think/scoring";
import { query } from "@/lib/db";
import { safeJsonParse } from "@/lib/utils";
import { SCORE_MAX, type SessionState } from "@/types";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireSession(["student"]);
    const { id } = await params;

    const result = await query<{ state: SessionState | string; status: string }>(
      `SELECT state, status FROM training_sessions
       WHERE tenant_id = $1 AND id = $2 AND user_id = $3 LIMIT 1`,
      [user.tenantId, id, user.id]
    );
    const row = result.rows[0];
    if (!row) return fail("会话不存在", 404);
    if (row.status === "finished") return fail("会话已结束");

    let state = safeJsonParse<SessionState>(row.state, row.state as SessionState);
    state = recomputeScores(state);
    state.branchPath = determineBranch(state);
    state.finished = true;

    const scoreTotal =
      state.scores.TRI +
      state.scores.INF +
      state.scores.DIA +
      state.scores.MAN +
      state.scores.DYN +
      state.scores.EBM;

    const report = {
      scores: state.scores,
      max: SCORE_MAX,
      total: scoreTotal,
      branchPath: state.branchPath,
      evidence: state.scoreEvidence,
      suggestions: [
        "补充非心源性胸痛鉴别清单",
        "记录任何导致 D2B 延长的因素",
        "强化社会史（烟酒）问诊覆盖",
      ],
    };

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
        scoreTotal,
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
