import type {
  CaseConfig,
  DecisionNodeId,
  SessionState,
  StandardPathItem,
} from "@/types";

export type PathCompareRow = {
  id: string;
  timeLabel: string;
  standard: string;
  student: string;
  correct: boolean;
};

export type { StandardPathItem };

const NODE_LABEL: Record<DecisionNodeId, string> = {
  P1: "分诊分级",
  P2: "关键检查时机",
  P3: "病史完整性",
  P4: "鉴别诊断",
  P5: "初始药物治疗",
  P6: "关键处置策略",
  P7: "动态监测",
  P8: "循证表达",
};

/** 若病例未配置 standardPath，按决策/关键检查/病情波生成默认对照路径 */
export function defaultStandardPath(caseConfig: CaseConfig): StandardPathItem[] {
  const items: StandardPathItem[] = [
    {
      id: "sp-p1",
      timeLabel: "T+0",
      standard: `完成 ${NODE_LABEL.P1}（写出级别与理由）`,
      type: "decision",
      decisionId: "P1",
      maxMinute: 5,
    },
  ];

  const criticalExam =
    caseConfig.exams.find((e) => e.critical) ||
    caseConfig.exams.find((e) => /心电图|ecg|血气|超声/i.test(e.label + e.id));
  if (criticalExam) {
    items.push({
      id: `sp-exam-${criticalExam.id}`,
      timeLabel: `T≤${Math.min(10, criticalExam.costMinutes + 5)}`,
      standard: `尽早开立「${criticalExam.label}」`,
      type: "exam",
      examId: criticalExam.id,
      maxMinute: 10,
    });
  }

  items.push({
    id: "sp-qa",
    timeLabel: "问诊阶段",
    standard: `完成核心问诊（至少解锁 ${Math.min(6, Math.max(3, Math.ceil(caseConfig.qaNodes.length * 0.4)))} 个节点）`,
    type: "qa",
    minQa: Math.min(6, Math.max(3, Math.ceil(caseConfig.qaNodes.length * 0.4))),
  });

  items.push(
    {
      id: "sp-p5",
      timeLabel: "处置阶段",
      standard: `完成 ${NODE_LABEL.P5}`,
      type: "decision",
      decisionId: "P5",
    },
    {
      id: "sp-p6",
      timeLabel: "处置阶段",
      standard: `完成 ${NODE_LABEL.P6}`,
      type: "decision",
      decisionId: "P6",
    }
  );

  for (const ev of caseConfig.clinicalEvents || []) {
    items.push({
      id: `sp-ev-${ev.id}`,
      timeLabel: `T+${ev.afterMinute}`,
      standard: `识别并正确处置：${ev.title}`,
      type: "event",
      eventId: ev.id,
    });
  }

  return items;
}

function evalItem(
  item: StandardPathItem,
  state: SessionState
): { student: string; correct: boolean } {
  if (item.type === "decision" && item.decisionId) {
    const d = state.decisions[item.decisionId];
    if (!d) return { student: "未完成", correct: false };
    const late = item.maxMinute != null && d.atMinute > item.maxMinute;
    return {
      student: late
        ? `T+${d.atMinute} 完成（超时）`
        : `T+${d.atMinute} 已完成`,
      correct: !late,
    };
  }

  if (item.type === "exam") {
    const ids = item.examIds?.length
      ? item.examIds
      : item.examId
        ? [item.examId]
        : [];
    const hits = state.examsOrdered.filter((e) =>
      ids.some((id) => e.examId.toLowerCase() === id.toLowerCase())
    );
    if (!hits.length) return { student: "未开立", correct: false };
    const best = hits.reduce((a, b) =>
      a.orderedAtMinute <= b.orderedAtMinute ? a : b
    );
    const late = item.maxMinute != null && best.orderedAtMinute > item.maxMinute;
    return {
      student: late
        ? `T+${best.orderedAtMinute} 开立（超时）`
        : `T+${best.orderedAtMinute} 已开立`,
      correct: !late,
    };
  }

  if (item.type === "qa") {
    const n = state.unlockedQaIds.length;
    const need = item.minQa || 5;
    return {
      student: `已解锁 ${n} 个问诊节点`,
      correct: n >= need,
    };
  }

  if (item.type === "event" && item.eventId) {
    const log = state.eventLog.find((e) => e.eventId === item.eventId);
    if (!log) return { student: "未触发/未处置", correct: false };
    if (log.avoided) return { student: "已避开该波恶化", correct: true };
    const ok =
      log.allCorrect === true ||
      (log.totalCorrect > 0 && log.correctCount >= Math.ceil(log.totalCorrect / 2));
    return {
      student: `已处置（选对 ${log.correctCount}/${log.totalCorrect}）`,
      correct: ok,
    };
  }

  return { student: "-", correct: false };
}

export function buildPathComparison(
  state: SessionState,
  caseConfig: CaseConfig | null | undefined
): PathCompareRow[] {
  if (!caseConfig) return [];
  const path =
    caseConfig.standardPath && caseConfig.standardPath.length > 0
      ? caseConfig.standardPath
      : defaultStandardPath(caseConfig);

  return path.map((item) => {
    const { student, correct } = evalItem(item, state);
    return {
      id: item.id,
      timeLabel: item.timeLabel,
      standard: item.standard,
      student,
      correct,
    };
  });
}
