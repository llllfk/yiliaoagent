import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { AuthError, requireSession } from "@/lib/auth";
import { validateCaseConfig } from "@/lib/er-think/case-validate";
import { query } from "@/lib/db";

/**
 * 教师导入病例包（JSON）
 * body: { config: CaseConfig, publish?: boolean }
 * 或直接传 CaseConfig 根对象
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireSession(["teacher"]);
    const body = await request.json();

    const rawConfig =
      body && typeof body === "object" && "config" in body
        ? (body as { config: unknown }).config
        : body;
    const publish =
      body && typeof body === "object" && "publish" in body
        ? Boolean((body as { publish?: boolean }).publish !== false)
        : true;

    const validated = validateCaseConfig(rawConfig);
    if (!validated.ok) {
      return fail("病例校验失败", 400, { errors: validated.errors });
    }

    const { config, warnings } = validated;

    const upserted = await query<{
      id: string;
      code: string;
      title: string;
      is_published: boolean;
    }>(
      `INSERT INTO cases (tenant_id, code, title, difficulty, target_minutes, config, is_published)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
       ON CONFLICT (tenant_id, code) DO UPDATE SET
         title = EXCLUDED.title,
         difficulty = EXCLUDED.difficulty,
         target_minutes = EXCLUDED.target_minutes,
         config = EXCLUDED.config,
         is_published = EXCLUDED.is_published,
         updated_at = NOW()
       RETURNING id, code, title, is_published`,
      [
        user.tenantId,
        config.code,
        config.title,
        config.difficulty,
        config.targetMinutes,
        JSON.stringify(config),
        publish,
      ]
    );

    const row = upserted.rows[0];
    return ok(
      {
        case: {
          id: Number(row.id),
          code: row.code,
          title: row.title,
          isPublished: row.is_published,
        },
        warnings,
        message: `病例 ${row.code} 已导入`,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return fail(error.message, error.status);
    }
    console.error(error);
    return fail("导入病例失败", 500);
  }
}
