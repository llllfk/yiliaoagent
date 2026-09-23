import type {
  CaseConfig,
  ClinicalEvent,
  DecisionNodeId,
  SessionState,
} from "@/types";

export function getActiveEvent(
  state: SessionState,
  caseConfig: CaseConfig | null | undefined
): ClinicalEvent | null {
  if (!state.activeEventId || !caseConfig?.clinicalEvents?.length) return null;
  return caseConfig.clinicalEvents.find((e) => e.id === state.activeEventId) || null;
}

function alreadyHandled(state: SessionState, eventId: string) {
  return state.eventLog.some((e) => e.eventId === eventId);
}

function decisionsDone(state: SessionState, ids?: DecisionNodeId[]) {
  if (!ids?.length) return false;
  return ids.every((id) => Boolean(state.decisions[id]?.reason));
}

function prerequisiteMet(state: SessionState, afterEventId?: string) {
  if (!afterEventId) return true;
  // 前置事件只要出现过（含「避开」记录）即可进入下一波，避免链条断掉
  return state.eventLog.some((e) => e.eventId === afterEventId);
}

/**
 * 时钟推进后评估是否触发新的病情变化。
 * 同一时间只保留一个 activeEvent；未处理完不会叠下一个。
 * 病情默认会反复波动：skipIfDecisions 仅表示「延后触发」，不再永久跳过。
 */
export function maybeTriggerClinicalEvent(
  state: SessionState,
  caseConfig: CaseConfig | null | undefined
): SessionState {
  if (!caseConfig?.clinicalEvents?.length || state.finished || state.activeEventId) {
    return state;
  }

  const events = [...caseConfig.clinicalEvents].sort(
    (a, b) => a.afterMinute - b.afterMinute
  );

  for (const ev of events) {
    if (alreadyHandled(state, ev.id)) continue;
    if (!prerequisiteMet(state, ev.afterEventId)) continue;

    // 若关键决策已完成，把恶化「稍延后」而不是取消，贴合「今天稳了马上又坏」
    let dueAt = ev.afterMinute;
    if (ev.skipIfDecisions && decisionsDone(state, ev.skipIfDecisions)) {
      dueAt = ev.afterMinute + 8;
    }
    if (state.simMinutes < dueAt) continue;

    return {
      ...state,
      activeEventId: ev.id,
      chat: [
        ...state.chat,
        {
          role: "system",
          text: `【病情变化 · ${ev.severity === "critical" ? "危急" : "波动"}】${ev.title}：${ev.description}${
            ev.vitals ? ` 生命体征：${ev.vitals}` : ""
          }`,
          at: new Date().toISOString(),
        },
        ...(ev.severity === "critical"
          ? [
              {
                role: "patient" as const,
                text: "大夫……我难受……喘不上气 / 头晕……你们快点……",
                at: new Date().toISOString(),
              },
            ]
          : []),
      ],
    };
  }

  return state;
}

export function resolveClinicalEvent(
  state: SessionState,
  caseConfig: CaseConfig,
  optionIds: string[]
): { state: SessionState; feedback: string; event: ClinicalEvent } {
  const event = getActiveEvent(state, caseConfig);
  if (!event) {
    throw new Error("当前没有待处理的病情变化");
  }

  const selected = new Set(optionIds);
  const correctOpts = event.options.filter((o) => o.correct);
  const wrongSelected = event.options.filter((o) => selected.has(o.id) && !o.correct);
  const correctSelected = correctOpts.filter((o) => selected.has(o.id));
  const missed = correctOpts.filter((o) => !selected.has(o.id));

  const allCorrect =
    correctSelected.length === correctOpts.length && wrongSelected.length === 0;

  let feedback: string;
  if (allCorrect) {
    feedback =
      event.resolveOk ||
      `处置正确：已覆盖 ${correctSelected.length} 项关键措施。病情可暂时稳定，请继续监测。`;
  } else if (correctSelected.length > 0) {
    feedback =
      event.resolveBad ||
      `部分正确（对 ${correctSelected.length}/${correctOpts.length}）。遗漏：${
        missed.map((m) => m.text.slice(0, 24)).join("；") || "无"
      }${wrongSelected.length ? `；不当选项：${wrongSelected.map((w) => w.text.slice(0, 20)).join("；")}` : ""}`;
  } else {
    feedback =
      event.resolveBad ||
      "本次处置不当，病情可能继续恶化。请回顾休克/急危重症处理原则。";
  }

  const next: SessionState = {
    ...state,
    activeEventId: null,
    eventLog: [
      ...state.eventLog,
      {
        eventId: event.id,
        triggeredAt: state.simMinutes,
        selectedOptionIds: optionIds,
        correctCount: correctSelected.length,
        totalCorrect: correctOpts.length,
        resolvedAt: state.simMinutes,
        avoided: false,
        allCorrect,
      },
    ],
    chat: [
      ...state.chat,
      {
        role: "system",
        text: `【处置反馈】${feedback}`,
        at: new Date().toISOString(),
      },
    ],
    simMinutes: state.simMinutes + 2,
  };

  return { state: next, feedback, event };
}
