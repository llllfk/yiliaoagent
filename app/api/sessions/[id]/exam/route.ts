import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { AuthError, requireSession } from "@/lib/auth";
import { getCaseConfig } from "@/lib/er-think/cases";
import { feedbackFromDelta } from "@/lib/er-think/scoring";
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
    const body = (await request.json()) as {
      action?: "physical" | "order";
      examId?: string;
      key?: string;
    };

    const result = await query<{
      state: SessionState | string;
      case_code: string;
      case_config: CaseConfig | string;
      status: string;
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

    let state = normalizeSessionState(
      safeJsonParse<SessionState>(row.state, row.state as SessionState)
    );
    let caseConfig = safeJsonParse<CaseConfig>(
      row.case_config,
      row.case_config as CaseConfig
    );
    if (!caseConfig?.exams) {
      caseConfig = getCaseConfig(row.case_code) as CaseConfig;
    }

    if (state.activeEventId) {
      return fail("请先处理当前病情变化，再开立检查", 409);
    }

    if (body.action === "physical") {
      const phys = caseConfig.physicalExam || {};
      const key = body.key?.trim();

      // 无 key：兼容旧客户端，一次揭示全部未揭示项（+2 分钟）
      if (!key) {
        const allKeys = Object.keys(phys);
        const next = {
          ...state,
          physicalKeys: [...new Set([...(state.physicalKeys || []), ...allKeys])],
          examsOrdered: [...state.examsOrdered],
          chat: [...state.chat],
          eventLog: [...state.eventLog],
          simMinutes: state.simMinutes + 2,
        };
        const scored = commitSessionState(next, caseConfig);
        const feedback = feedbackFromDelta(state, scored);
        await query(
          `UPDATE training_sessions SET state = $1::jsonb, updated_at = NOW() WHERE id = $2`,
          [JSON.stringify(scored), id]
        );
        return ok({
          physicalExam: phys,
          feedback,
          eventTriggered: Boolean(scored.activeEventId),
          state: scored,
        });
      }

      if (!(key in phys)) return fail("查体项目不存在");
      if ((state.physicalKeys || []).includes(key)) {
        const revealed = Object.fromEntries(
          (state.physicalKeys || []).map((k) => [k, phys[k]])
        );
        return ok({
          message: "该查体项已完成",
          physicalExam: { [key]: phys[key] },
          revealed,
          state,
        });
      }

      const next = {
        ...state,
        physicalKeys: [...(state.physicalKeys || []), key],
        examsOrdered: [...state.examsOrdered],
        chat: [...state.chat],
        eventLog: [...state.eventLog],
        simMinutes: state.simMinutes + 1,
      };
      const scored = commitSessionState(next, caseConfig);
      const feedback = feedbackFromDelta(state, scored);
      const revealed = Object.fromEntries(
        scored.physicalKeys.map((k) => [k, phys[k]])
      );
      await query(
        `UPDATE training_sessions SET state = $1::jsonb, updated_at = NOW() WHERE id = $2`,
        [JSON.stringify(scored), id]
      );
      return ok({
        physicalExam: { [key]: phys[key] },
        revealed,
        feedback,
        eventTriggered: Boolean(scored.activeEventId),
        state: scored,
      });
    }

    const examId = body.examId;
    if (!examId) return fail("请选择检查项目");
    const exam = caseConfig.exams.find((e) => e.id === examId);
    if (!exam) return fail("检查项目不存在");

    const exists = state.examsOrdered.find((e) => e.examId === examId);
    if (exists) {
      return ok({
        message: `该检查已在 T+${exists.orderedAtMinute} 分钟申请`,
        exam: exists,
        state,
      });
    }

    const orderedAt = state.simMinutes;
    const readyAt = orderedAt + exam.costMinutes;
    const next: SessionState = {
      ...state,
      examsOrdered: [
        ...state.examsOrdered,
        {
          examId,
          orderedAtMinute: orderedAt,
          readyAtMinute: readyAt,
          revealed: false,
        },
      ],
      chat: [...state.chat],
      eventLog: [...state.eventLog],
      simMinutes: state.simMinutes + 1,
    };
    const scored = commitSessionState(next, caseConfig);
    const feedback = feedbackFromDelta(state, scored);
    const timeoutWarning =
      examId.toLowerCase().includes("ecg") && orderedAt > 10
        ? `超时警告：首份心电图于 T+${orderedAt} 开立，超过 ≤10 分钟要求，将影响评分并可能进入延误结局。`
        : null;

    await query(
      `UPDATE training_sessions SET state = $1::jsonb, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(scored), id]
    );

    return ok({
      ordered: {
        examId,
        label: exam.label,
        readyAtMinute: readyAt,
        resultPreview: scored.simMinutes >= readyAt ? exam.result : "未回报",
        critical: exam.critical || false,
        costFee: exam.costFee ?? null,
        costMinutes: exam.costMinutes,
      },
      feedback,
      timeoutWarning,
      eventTriggered: Boolean(scored.activeEventId),
      state: scored,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return fail(error.message, error.status);
    }
    console.error(error);
    return fail("检查操作失败", 500);
  }
}
