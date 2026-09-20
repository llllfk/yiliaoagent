import { fail, ok } from "@/lib/api";
import { AuthError, requireSession } from "@/lib/auth";
import { listCaseConfigs } from "@/lib/er-think/cases";
import { query } from "@/lib/db";

export async function GET() {
  try {
    const user = await requireSession();
    const dbCases = await query<{
      id: string;
      code: string;
      title: string;
      difficulty: string | null;
      target_minutes: string | null;
    }>(
      `SELECT id, code, title, difficulty, target_minutes
       FROM cases
       WHERE tenant_id = $1 AND is_published = TRUE
       ORDER BY id ASC`,
      [user.tenantId]
    );

    // 库中无病例时回退到内置 JSON（便于未 seed 时开发）
    if (dbCases.rows.length === 0) {
      return ok({
        source: "builtin",
        cases: listCaseConfigs().map((c) => ({
          id: null,
          code: c.code,
          title: c.title,
          difficulty: c.difficulty,
          targetMinutes: c.targetMinutes,
        })),
      });
    }

    return ok({
      source: "db",
      cases: dbCases.rows.map((c) => ({
        id: Number(c.id),
        code: c.code,
        title: c.title,
        difficulty: c.difficulty,
        targetMinutes: c.target_minutes,
      })),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return fail(error.message, error.status);
    }
    console.error(error);
    return fail("获取病例失败", 500);
  }
}
