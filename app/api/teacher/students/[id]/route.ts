import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { AuthError, hashPassword, requireSession } from "@/lib/auth";
import { getPool, query } from "@/lib/db";
import { normalizeStudentAccount } from "@/lib/student-account";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const teacher = await requireSession(["teacher"]);
    const { id } = await params;
    const body = (await request.json()) as {
      displayName?: string;
      username?: string;
      password?: string;
    };
    const parsed = normalizeStudentAccount(body, "update");
    if (!parsed.ok) return fail(parsed.error);

    const existing = await query<{ id: string }>(
      `SELECT id FROM users
       WHERE tenant_id = $1 AND id = $2 AND role = 'student'
       LIMIT 1`,
      [teacher.tenantId, id]
    );
    if (!existing.rows[0]) return fail("学生不存在", 404);

    const passwordHash = parsed.password
      ? await hashPassword(parsed.password)
      : null;

    try {
      const updated = await query<{ id: string; username: string; display_name: string }>(
        `UPDATE users
         SET display_name = $1,
             username = $2,
             password_hash = COALESCE($3, password_hash),
             updated_at = NOW()
         WHERE tenant_id = $4 AND id = $5 AND role = 'student'
         RETURNING id, username, display_name`,
        [
          parsed.displayName,
          parsed.username,
          passwordHash,
          teacher.tenantId,
          id,
        ]
      );
      const row = updated.rows[0];
      return ok({
        student: {
          id: Number(row.id),
          username: row.username,
          displayName: row.display_name,
          passwordChanged: Boolean(passwordHash),
        },
      });
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: string }).code === "23505"
      ) {
        return fail("该账号已存在", 409);
      }
      throw error;
    }
  } catch (error) {
    if (error instanceof AuthError) return fail(error.message, error.status);
    console.error(error);
    return fail("修改学生失败", 500);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const teacher = await requireSession(["teacher"]);
    const { id } = await params;

    const client = await getPool().connect();
    try {
      await client.query("BEGIN");
      const found = await client.query(
        `SELECT id FROM users
         WHERE tenant_id = $1 AND id = $2 AND role = 'student'
         LIMIT 1`,
        [teacher.tenantId, id]
      );
      if (!found.rows[0]) {
        await client.query("ROLLBACK");
        return fail("学生不存在", 404);
      }
      await client.query(
        `DELETE FROM training_sessions WHERE tenant_id = $1 AND user_id = $2`,
        [teacher.tenantId, id]
      );
      await client.query(
        `DELETE FROM users WHERE tenant_id = $1 AND id = $2 AND role = 'student'`,
        [teacher.tenantId, id]
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    return ok({ deleted: true });
  } catch (error) {
    if (error instanceof AuthError) return fail(error.message, error.status);
    console.error(error);
    return fail("删除学生失败", 500);
  }
}
