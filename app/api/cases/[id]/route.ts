import { fail, ok } from "@/lib/api";
import { AuthError, requireSession } from "@/lib/auth";
import { getCaseConfig } from "@/lib/er-think/cases";
import { query } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireSession();
    const { id } = await params;

    // 支持按数字 id 或 code 查询
    if (/^\d+$/.test(id)) {
      const result = await query<{
        id: string;
        code: string;
        title: string;
        config: unknown;
      }>(
        `SELECT id, code, title, config FROM cases
         WHERE tenant_id = $1 AND id = $2 LIMIT 1`,
        [user.tenantId, id]
      );
      if (!result.rows[0]) return fail("病例不存在", 404);
      return ok({ case: result.rows[0] });
    }

    const result = await query<{
      id: string;
      code: string;
      title: string;
      config: unknown;
    }>(
      `SELECT id, code, title, config FROM cases
       WHERE tenant_id = $1 AND code = $2 LIMIT 1`,
      [user.tenantId, id]
    );
    if (result.rows[0]) {
      return ok({ case: result.rows[0] });
    }

    const builtin = getCaseConfig(id);
    if (!builtin) return fail("病例不存在", 404);
    return ok({ case: { id: null, ...builtin } });
  } catch (error) {
    if (error instanceof AuthError) {
      return fail(error.message, error.status);
    }
    console.error(error);
    return fail("获取病例详情失败", 500);
  }
}
