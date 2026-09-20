import { fail, ok } from "@/lib/api";
import { AuthError, requireSession } from "@/lib/auth";
import { query } from "@/lib/db";
import type { SessionState } from "@/types";

async function loadSession(tenantId: number, sessionId: string, userId?: number) {
  const params: unknown[] = [tenantId, sessionId];
  let sql = `SELECT s.*, c.code AS case_code, c.title AS case_title, c.config AS case_config,
                    u.display_name AS student_name
             FROM training_sessions s
             JOIN cases c ON c.id = s.case_id
             JOIN users u ON u.id = s.user_id
             WHERE s.tenant_id = $1 AND s.id = $2`;
  if (userId != null) {
    sql += ` AND s.user_id = $3`;
    params.push(userId);
  }
  sql += ` LIMIT 1`;
  return query(sql, params);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireSession();
    const { id } = await params;
    const result =
      user.role === "teacher"
        ? await loadSession(user.tenantId, id)
        : await loadSession(user.tenantId, id, user.id);

    if (!result.rows[0]) return fail("会话不存在", 404);
    return ok({ session: result.rows[0] });
  } catch (error) {
    if (error instanceof AuthError) {
      return fail(error.message, error.status);
    }
    console.error(error);
    return fail("获取会话失败", 500);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireSession(["student"]);
    const { id } = await params;
    const body = (await request.json()) as { state?: SessionState };
    if (!body.state) return fail("缺少 state");

    const result = await query(
      `UPDATE training_sessions
       SET state = $1::jsonb, updated_at = NOW()
       WHERE tenant_id = $2 AND id = $3 AND user_id = $4 AND status = 'in_progress'
       RETURNING id`,
      [JSON.stringify(body.state), user.tenantId, id, user.id]
    );
    if (!result.rows[0]) return fail("会话不可更新", 404);
    return ok({ updated: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return fail(error.message, error.status);
    }
    console.error(error);
    return fail("更新会话失败", 500);
  }
}
