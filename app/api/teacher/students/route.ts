import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { AuthError, hashPassword, requireSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { normalizeStudentAccount } from "@/lib/student-account";

export async function GET() {
  try {
    const user = await requireSession(["teacher"]);
    const result = await query<{
      id: string;
      username: string;
      display_name: string;
      student_no: string | null;
      is_active: boolean;
      created_at: Date;
    }>(
      `SELECT id, username, display_name, student_no, is_active, created_at
       FROM users
       WHERE tenant_id = $1 AND role = 'student'
       ORDER BY created_at DESC`,
      [user.tenantId]
    );

    return ok({
      students: result.rows.map((r) => ({
        id: Number(r.id),
        username: r.username,
        displayName: r.display_name,
        studentNo: r.student_no,
        isActive: r.is_active,
        createdAt: r.created_at,
      })),
    });
  } catch (error) {
    if (error instanceof AuthError) return fail(error.message, error.status);
    console.error(error);
    return fail("获取学生列表失败", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireSession(["teacher"]);
    const body = (await request.json()) as {
      displayName?: string;
      username?: string;
      password?: string;
    };
    const parsed = normalizeStudentAccount(body, "create");
    if (!parsed.ok) return fail(parsed.error);
    if (!parsed.password) return fail("请设置密码");

    const passwordHash = await hashPassword(parsed.password);
    try {
      const inserted = await query<{ id: string }>(
        `INSERT INTO users (tenant_id, username, password_hash, display_name, role)
         VALUES ($1, $2, $3, $4, 'student')
         RETURNING id`,
        [user.tenantId, parsed.username, passwordHash, parsed.displayName]
      );
      return ok(
        {
          student: {
            id: Number(inserted.rows[0].id),
            username: parsed.username,
            displayName: parsed.displayName,
          },
        },
        { status: 201 }
      );
    } catch (error) {
      if (isUniqueViolation(error)) return fail("该账号已存在", 409);
      throw error;
    }
  } catch (error) {
    if (error instanceof AuthError) return fail(error.message, error.status);
    console.error(error);
    return fail("新增学生失败", 500);
  }
}

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}
