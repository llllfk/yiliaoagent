import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { AuthError, requireSession } from "@/lib/auth";
import { query } from "@/lib/db";

/** 教师：发布/下架病例 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireSession(["teacher"]);
    const { id } = await params;
    const body = (await request.json()) as { isPublished?: boolean };
    if (typeof body.isPublished !== "boolean") {
      return fail("请提供 isPublished: boolean");
    }

    const result = await query<{ id: string; code: string; is_published: boolean }>(
      `UPDATE cases
       SET is_published = $1, updated_at = NOW()
       WHERE tenant_id = $2 AND id = $3
       RETURNING id, code, is_published`,
      [body.isPublished, user.tenantId, id]
    );
    if (!result.rows[0]) return fail("病例不存在", 404);

    return ok({
      case: {
        id: Number(result.rows[0].id),
        code: result.rows[0].code,
        isPublished: result.rows[0].is_published,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return fail(error.message, error.status);
    }
    console.error(error);
    return fail("更新病例失败", 500);
  }
}
