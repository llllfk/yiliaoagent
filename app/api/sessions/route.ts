import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { AuthError, requireSession } from "@/lib/auth";
import { getCaseConfig } from "@/lib/er-think/cases";
import { query } from "@/lib/db";
import { createInitialSessionState } from "@/types";

export async function GET() {
  try {
    const user = await requireSession();
    const result = await query(
      `SELECT s.id, s.status, s.score_total, s.branch_path, s.started_at, s.finished_at,
              c.code AS case_code, c.title AS case_title
       FROM training_sessions s
       JOIN cases c ON c.id = s.case_id
       WHERE s.tenant_id = $1 AND s.user_id = $2
       ORDER BY s.started_at DESC
       LIMIT 50`,
      [user.tenantId, user.id]
    );
    return ok({ sessions: result.rows });
  } catch (error) {
    if (error instanceof AuthError) {
      return fail(error.message, error.status);
    }
    console.error(error);
    return fail("获取训练记录失败", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireSession(["student"]);
    const body = (await request.json()) as { caseCode?: string };
    const caseCode = body.caseCode || "stemi-03";

    let caseRow = await query<{ id: string }>(
      `SELECT id FROM cases WHERE tenant_id = $1 AND code = $2 LIMIT 1`,
      [user.tenantId, caseCode]
    );

    if (!caseRow.rows[0]) {
      const cfg = getCaseConfig(caseCode);
      if (!cfg) return fail("病例不存在", 404);
      const inserted = await query<{ id: string }>(
        `INSERT INTO cases (tenant_id, code, title, difficulty, target_minutes, config)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb)
         ON CONFLICT (tenant_id, code) DO UPDATE SET title = EXCLUDED.title
         RETURNING id`,
        [
          user.tenantId,
          cfg.code,
          cfg.title,
          cfg.difficulty,
          cfg.targetMinutes,
          JSON.stringify(cfg),
        ]
      );
      caseRow = inserted;
    }

    const state = createInitialSessionState();
    const cfgHint = getCaseConfig(caseCode);
    const waveHint = cfgHint?.clinicalEvents?.length
      ? `本案设计了 ${cfgHint.clinicalEvents.length} 波病情波动/恶化（约 T+${Math.min(
          ...cfgHint.clinicalEvents.map((e) => e.afterMinute)
        )} 起）。急诊病程很少一帆风顺：可能先加重、再短暂好转、再合并休克/心衰/呼吸衰竭等，请用「继续观察」推进时钟并及时处置。`
      : "请按问诊—检查—决策推进训练；注意动态评估。";
    state.chat.push({
      role: "system",
      text: waveHint,
      at: new Date().toISOString(),
    });

    const created = await query<{ id: string }>(
      `INSERT INTO training_sessions (tenant_id, user_id, case_id, status, state)
       VALUES ($1, $2, $3, 'in_progress', $4::jsonb)
       RETURNING id`,
      [user.tenantId, user.id, caseRow.rows[0].id, JSON.stringify(state)]
    );

    return ok({ sessionId: Number(created.rows[0].id), state }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return fail(error.message, error.status);
    }
    console.error(error);
    return fail("创建训练会话失败", 500);
  }
}
