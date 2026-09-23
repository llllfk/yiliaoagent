import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { AuthError, requireSession } from "@/lib/auth";
import { resolveClinicalEvent } from "@/lib/er-think/clinical-events";
import { getCaseConfig } from "@/lib/er-think/cases";
import { commitSessionState, normalizeSessionState } from "@/lib/er-think/session-flow";
import { query } from "@/lib/db";
import { safeJsonParse } from "@/lib/utils";
import type { CaseConfig, SessionState } from "@/types";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireSession(["student"]);
    const { id } = await params;
    const body = (await request.json()) as { optionIds?: string[] };
    const optionIds = Array.isArray(body.optionIds)
      ? body.optionIds.map(String).filter(Boolean)
      : [];
    if (optionIds.length === 0) return fail("请至少选择一项处置措施");

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
    if (!row || row.status !== "in_progress") return fail("会话不可用", 404);

    let caseConfig = safeJsonParse<CaseConfig>(
      row.case_config,
      row.case_config as CaseConfig
    );
    if (!caseConfig?.qaNodes?.length) {
      caseConfig = getCaseConfig(row.case_code) || caseConfig;
    }

    let state = normalizeSessionState(
      safeJsonParse<SessionState>(row.state, row.state as SessionState)
    );

    const resolved = resolveClinicalEvent(state, caseConfig!, optionIds);
    state = commitSessionState(resolved.state, caseConfig);

    await query(
      `UPDATE training_sessions SET state = $1::jsonb, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(state), id]
    );

    return ok({
      feedback: resolved.feedback,
      eventId: resolved.event.id,
      state,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return fail(error.message, error.status);
    }
    if (error instanceof Error && error.message.includes("没有待处理")) {
      return fail(error.message, 400);
    }
    console.error(error);
    return fail("病情变化处置失败", 500);
  }
}
