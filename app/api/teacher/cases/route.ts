import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { AuthError, requireSession } from "@/lib/auth";
import { query } from "@/lib/db";

/** 教师：本租户病例列表 */
export async function GET() {
  try {
    const user = await requireSession(["teacher"]);
    const result = await query<{
      id: string;
      code: string;
      title: string;
      difficulty: string | null;
      target_minutes: string | null;
      is_published: boolean;
      updated_at: Date;
    }>(
      `SELECT id, code, title, difficulty, target_minutes, is_published, updated_at
       FROM cases
       WHERE tenant_id = $1
       ORDER BY updated_at DESC`,
      [user.tenantId]
    );

    return ok({
      cases: result.rows.map((r) => ({
        id: Number(r.id),
        code: r.code,
        title: r.title,
        difficulty: r.difficulty,
        targetMinutes: r.target_minutes,
        isPublished: r.is_published,
        updatedAt: r.updated_at,
      })),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return fail(error.message, error.status);
    }
    console.error(error);
    return fail("获取病例列表失败", 500);
  }
}

/** 兼容：也允许 POST 到列表路由做简单查询参数扩展，实际导入走 /import */
export async function POST(request: NextRequest) {
  // 转发语义：若误发到此，提示正确路径
  void request;
  return fail("请使用 POST /api/teacher/cases/import 导入病例", 405);
}
