import type {
  BranchPath,
  CaseConfig,
  QaNode,
  ScoreDimensions,
  SessionState,
} from "@/types";
import { SCORE_MAX, emptyScores } from "@/types";
import { buildPathComparison } from "@/lib/er-think/path-compare";

export type ScoreEvidence = {
  dim: keyof ScoreDimensions;
  points: number;
  rule: string;
  evidence: string;
};

export const BRANCH_OUTCOME: Record<BranchPath, { title: string; text: string }> = {
  A: {
    title: "标准结局",
    text: "关键时间窗与处置策略正确，患者按预期好转。",
  },
  B: {
    title: "延误诊治",
    text: "关键检查或处置延误，病情加重，需强化时间窗与优先处置意识。",
  },
  C: {
    title: "过度检查",
    text: "在诊断已较明确时仍加做高成本/高辐射检查，耽误关键治疗并增加负担。",
  },
  D: {
    title: "混合 / 不完善结局",
    text: "问诊、检查或病情处置未形成完整闭环，需复盘覆盖度、时间窗与动态处置。",
  },
};

const STEMI_BRANCH: Record<BranchPath, { title: string; text: string }> = {
  A: {
    title: "标准结局",
    text: "首份心电图在时间窗内完成，问诊与病情处置基本到位。预计按规范路径救治，无严重并发症。",
  },
  B: {
    title: "延误诊治",
    text: "首份心电图超出 10 分钟时间窗。心肌缺血时间延长，患者可能出现心源性休克，需转入 ICU。",
  },
  C: {
    title: "过度检查",
    text: "在 STEMI 已较明确时仍加做 CTA 或胸片等非必要检查，耽误关键处理，并增加辐射与费用。",
  },
  D: {
    title: "混合 / 不完善结局",
    text: "问诊、关键检查或病情处置未形成完整闭环。需复盘时间窗、鉴别检查与动态处置。",
  },
};

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

function add(
  scores: ScoreDimensions,
  evidence: ScoreEvidence[],
  dim: keyof ScoreDimensions,
  points: number,
  rule: string,
  proof: string
) {
  if (points <= 0) return;
  const room = round1(SCORE_MAX[dim] - scores[dim]);
  const gain = round1(Math.min(points, room));
  if (gain <= 0) return;
  scores[dim] = round1(scores[dim] + gain);
  evidence.push({ dim, points: gain, rule, evidence: proof });
}

function isStemiCase(caseConfig?: CaseConfig | null) {
  if (!caseConfig) return true; // 兼容旧调用：默认 STEMI 规则
  if (caseConfig.scoringHints?.profile === "stemi") return true;
  if (caseConfig.scoringHints?.profile === "generic") return false;
  const key = `${caseConfig.code} ${caseConfig.title} ${caseConfig.category || ""}`;
  return /stemi|chest-pain|胸痛|心梗|STEMI/i.test(key);
}

function bucket(node: QaNode) {
  const c = node.category || "";
  if (c.includes("社会") || node.id === "Q16") return "social";
  if (node.safety || c.includes("安全") || node.id === "Q19") return "safety";
  if (c.includes("主诉")) return "chief";
  if (c.includes("部位") || c.includes("疼痛")) return "site";
  if (c.includes("性质")) return "quality";
  if (c.includes("程度")) return "severity";
  if (c.includes("放射")) return "radiate";
  if (c.includes("时间") || c.includes("病程")) return "time";
  if (c.includes("诱因") || c.includes("缓解")) return "trigger";
  if (c.includes("伴随")) return "assoc";
  if (c.includes("既往") || c.includes("危险")) return "pmh";
  if (c.includes("家族")) return "family";
  return "other";
}

const CORE_BUCKETS = [
  "chief",
  "site",
  "quality",
  "severity",
  "radiate",
  "time",
  "trigger",
  "assoc",
  "pmh",
  "family",
] as const;

const BUCKET_LABEL: Record<(typeof CORE_BUCKETS)[number], string> = {
  chief: "主诉",
  site: "部位",
  quality: "性质",
  severity: "程度",
  radiate: "放射",
  time: "时间",
  trigger: "诱因",
  assoc: "伴随症状",
  pmh: "既往史",
  family: "家族史",
};

function scoreInfFromQa(
  scores: ScoreDimensions,
  evidence: ScoreEvidence[],
  state: SessionState,
  qaNodes: QaNode[]
) {
  const unlocked = new Set(state.unlockedQaIds);
  if (qaNodes.length === 0) return;

  const hitBuckets = new Set<string>();
  for (const node of qaNodes) {
    if (unlocked.has(node.id)) hitBuckets.add(bucket(node));
  }

  // STEMI 细分类别
  let usedFine = false;
  for (const name of CORE_BUCKETS) {
    if (hitBuckets.has(name)) {
      usedFine = true;
      add(scores, evidence, "INF", 1.5, `问诊覆盖：${BUCKET_LABEL[name]}`, "已解锁该问诊类别");
    }
  }
  if (hitBuckets.has("social")) {
    usedFine = true;
    add(scores, evidence, "INF", 2, "社会史", "已询问烟酒等社会史");
  }
  if (hitBuckets.has("safety")) {
    usedFine = true;
    add(scores, evidence, "INF", 3, "安全史", "已询问过敏或当前用药");
  }
  if (hitBuckets.has("other") && usedFine) {
    add(scores, evidence, "INF", 1.5, "问诊覆盖：其他核心项", "已解锁未归类核心问诊");
  }

  // 通用：按解锁比例补足（Demo 病例类别较粗）
  if (!usedFine || scores.INF < 8) {
    const ratio = unlocked.size / qaNodes.length;
    const pts = round1(Math.min(20, ratio * 18));
    if (pts > scores.INF) {
      add(
        scores,
        evidence,
        "INF",
        round1(pts - scores.INF),
        "问诊覆盖度",
        `已解锁 ${unlocked.size}/${qaNodes.length} 个问诊节点`
      );
    }
  }
}

function findEcgOrder(state: SessionState) {
  return state.examsOrdered.find(
    (e) =>
      e.examId.toLowerCase().includes("ecg") ||
      e.examId.toLowerCase() === "e1" ||
      e.examId.toLowerCase().includes("心电图")
  );
}

function examBlob(state: SessionState, caseConfig?: CaseConfig | null) {
  return state.examsOrdered
    .map((o) => {
      const meta = caseConfig?.exams?.find((e) => e.id === o.examId);
      return `${o.examId} ${meta?.label || ""}`;
    })
    .join(" ");
}

function scoreTriFromWorkup(
  scores: ScoreDimensions,
  evidence: ScoreEvidence[],
  state: SessionState,
  caseConfig?: CaseConfig | null
) {
  const ecg = findEcgOrder(state);
  if (isStemiCase(caseConfig)) {
    if (ecg && ecg.orderedAtMinute <= 10) {
      add(
        scores,
        evidence,
        "TRI",
        12,
        "首份心电图在 10 分钟内开立",
        `T+${ecg.orderedAtMinute} 开立心电图`
      );
    } else if (ecg) {
      add(
        scores,
        evidence,
        "TRI",
        4,
        "已开立心电图但超时",
        `T+${ecg.orderedAtMinute} 开立心电图`
      );
    }
  } else if (ecg && ecg.orderedAtMinute <= 15) {
    add(
      scores,
      evidence,
      "TRI",
      8,
      "关键检查较早开立",
      `T+${ecg.orderedAtMinute} 开立心电图/关键检查`
    );
  }

  if (state.examsOrdered.some((e) => e.orderedAtMinute <= 15)) {
    add(scores, evidence, "TRI", 6, "早期开立检查", "15 分钟内已有检查申请");
  }
  if ((state.physicalKeys || []).length > 0) {
    add(
      scores,
      evidence,
      "TRI",
      5,
      "已开始系统查体",
      `已完成 ${state.physicalKeys.length} 项查体`
    );
  }
  if (!isStemiCase(caseConfig) && state.examsOrdered.length > 0) {
    add(scores, evidence, "TRI", 4, "已启动辅助检查", `共开立 ${state.examsOrdered.length} 项`);
  }
}

function scoreDiaFromWorkup(
  scores: ScoreDimensions,
  evidence: ScoreEvidence[],
  state: SessionState,
  qaNodes: QaNode[],
  caseConfig?: CaseConfig | null
) {
  const blob = examBlob(state, caseConfig);
  const unlocked = new Set(state.unlockedQaIds);

  if (isStemiCase(caseConfig)) {
    if (/ecg|心电图|e1/i.test(blob)) {
      add(scores, evidence, "DIA", 8, "完成心电图评估", "已开立心电图");
    }
    if (/troponin|肌钙|l1/i.test(blob)) {
      add(scores, evidence, "DIA", 6, "完成心肌损伤标志物", "已开立肌钙蛋白相关检查");
    }
    if (/d-?dimer|d二聚|肺栓塞|cta|夹层/i.test(blob)) {
      add(scores, evidence, "DIA", 3, "完成高危鉴别相关检查", "已开立排查夹层/PE 相关检查");
    }
    const hitBuckets = new Set<string>();
    for (const node of qaNodes) {
      if (unlocked.has(node.id)) hitBuckets.add(bucket(node));
    }
    let qaDia = 0;
    for (const name of ["radiate", "pmh", "family", "assoc"] as const) {
      if (hitBuckets.has(name)) qaDia += 1;
    }
    if (qaDia >= 2) {
      add(
        scores,
        evidence,
        "DIA",
        3,
        "问诊支持鉴别诊断",
        `已覆盖 ${qaDia} 类关键病史信息`
      );
    }
    return;
  }

  const hints = caseConfig?.scoringHints;
  const dxKeys = hints?.diagnosisKeywords || [];
  const qaText = qaNodes
    .filter((n) => unlocked.has(n.id))
    .map((n) => `${n.category} ${n.answer || ""} ${(n.intents || []).join(" ")}`)
    .join(" ");
  let diaHit = 0;
  for (const kw of dxKeys) {
    if (kw && (qaText.includes(kw) || blob.includes(kw))) {
      diaHit += 1;
      add(scores, evidence, "DIA", 4, `鉴别相关：${kw}`, kw);
      if (diaHit >= 4) break;
    }
  }
  if (diaHit === 0 && state.examsOrdered.length >= 2) {
    add(scores, evidence, "DIA", 8, "已做多项辅助检查支持鉴别", `开立 ${state.examsOrdered.length} 项`);
  }
  if ((state.physicalKeys || []).length >= 2) {
    add(scores, evidence, "DIA", 4, "查体信息支持鉴别", `查体 ${state.physicalKeys.length} 项`);
  }
}

function scoreManDynFromEvents(
  scores: ScoreDimensions,
  evidence: ScoreEvidence[],
  state: SessionState,
  caseConfig?: CaseConfig | null
) {
  const events = caseConfig?.clinicalEvents || [];
  const logs = state.eventLog || [];
  const medHints = caseConfig?.scoringHints?.essentialMedNames || [];
  const stratHints = caseConfig?.scoringHints?.recommendedStrategies || [];

  for (const log of logs) {
    if (log.avoided) {
      add(scores, evidence, "DYN", 3, "及时处置避开恶化", `事件 ${log.eventId}`);
      continue;
    }
    if (log.allCorrect) {
      add(
        scores,
        evidence,
        "MAN",
        5,
        "病情变化处置正确",
        `${log.eventId} ${log.correctCount}/${log.totalCorrect}`
      );
      add(scores, evidence, "DYN", 2, "动态处置完成", log.eventId);
    } else if (log.correctCount > 0) {
      add(
        scores,
        evidence,
        "MAN",
        2,
        "病情变化部分处置",
        `${log.eventId} ${log.correctCount}/${log.totalCorrect}`
      );
      add(scores, evidence, "DYN", 1, "动态处置部分完成", log.eventId);
    }

    const ev = events.find((e) => e.id === log.eventId);
    if (!ev) continue;
    const selectedText = ev.options
      .filter((o) => log.selectedOptionIds.includes(o.id))
      .map((o) => o.text)
      .join(" ");
    for (const med of medHints) {
      const token = med.replace(/[（(].*$/, "").slice(0, 4);
      if (token && selectedText.includes(token)) {
        add(scores, evidence, "MAN", 2, `处置含关键用药：${token}`, selectedText.slice(0, 60));
      }
    }
    for (const s of stratHints) {
      const token = s.slice(0, 4);
      if (token && selectedText.includes(token)) {
        add(scores, evidence, "MAN", 2, `处置含关键策略：${token}`, selectedText.slice(0, 60));
        break;
      }
    }
  }

  if (events.length > 0) {
    const handled = logs.filter((l) =>
      events.some((e) => e.id === l.eventId)
    ).length;
    const ratio = handled / events.length;
    if (ratio >= 1) {
      add(
        scores,
        evidence,
        "DYN",
        4,
        "完成全部病情波观察处置",
        `${handled}/${events.length}`
      );
    } else if (ratio >= 0.5) {
      add(
        scores,
        evidence,
        "DYN",
        2,
        "完成半数以上病情波",
        `${handled}/${events.length}`
      );
    }
  } else if ((state.physicalKeys || []).length > 0 && state.examsOrdered.length > 0) {
    add(scores, evidence, "DYN", 5, "查体与检查闭环推进", "无配置病情波，以操作闭环计分");
  }
}

function scoreEbmFromPractice(
  scores: ScoreDimensions,
  evidence: ScoreEvidence[],
  state: SessionState,
  caseConfig?: CaseConfig | null
) {
  const ecg = findEcgOrder(state);
  const logs = state.eventLog || [];
  const events = caseConfig?.clinicalEvents || [];
  const allEventsOk =
    events.length > 0 &&
    logs.length >= events.length &&
    logs.every((l) => l.allCorrect || l.avoided);

  if (isStemiCase(caseConfig) && ecg && ecg.orderedAtMinute <= 10) {
    add(scores, evidence, "EBM", 3, "符合指南心电图时间窗", `T+${ecg.orderedAtMinute}`);
  } else if (!isStemiCase(caseConfig) && state.examsOrdered.some((e) => e.orderedAtMinute <= 15)) {
    add(scores, evidence, "EBM", 3, "符合早期关键检查原则", "15 分钟内启动检查");
  }

  if (allEventsOk) {
    add(scores, evidence, "EBM", 2, "病情处置符合急危重症处理原则", `完成 ${events.length} 波正确处置`);
  } else if (logs.some((l) => l.allCorrect)) {
    add(scores, evidence, "EBM", 1, "部分处置符合规范", "至少一波处置全对");
  }
}

/** STEMI：问诊 + 检查时机/项目 + 病情处置（不再依赖 P1–P8 文本） */
function scoreStemi(
  scores: ScoreDimensions,
  evidence: ScoreEvidence[],
  state: SessionState,
  qaNodes: QaNode[],
  caseConfig?: CaseConfig | null
) {
  scoreTriFromWorkup(scores, evidence, state, caseConfig);
  scoreInfFromQa(scores, evidence, state, qaNodes);
  scoreDiaFromWorkup(scores, evidence, state, qaNodes, caseConfig);
  scoreManDynFromEvents(scores, evidence, state, caseConfig);
  scoreEbmFromPractice(scores, evidence, state, caseConfig);
}

/** 通用病例：问诊 + 检查 + 病情处置 + scoringHints */
function scoreGeneric(
  scores: ScoreDimensions,
  evidence: ScoreEvidence[],
  state: SessionState,
  qaNodes: QaNode[],
  caseConfig?: CaseConfig | null
) {
  scoreTriFromWorkup(scores, evidence, state, caseConfig);
  scoreInfFromQa(scores, evidence, state, qaNodes);
  scoreDiaFromWorkup(scores, evidence, state, qaNodes, caseConfig);
  scoreManDynFromEvents(scores, evidence, state, caseConfig);
  scoreEbmFromPractice(scores, evidence, state, caseConfig);
}

/** 按规则重算六维分：问诊 + 检查 + 病情处置（不再依赖 P1–P8） */
export function recomputeScores(
  state: SessionState,
  qaNodes: QaNode[] = [],
  caseConfig?: CaseConfig | null
): SessionState {
  const scores = emptyScores();
  const evidence: ScoreEvidence[] = [];
  if (isStemiCase(caseConfig)) {
    scoreStemi(scores, evidence, state, qaNodes, caseConfig);
  } else {
    scoreGeneric(scores, evidence, state, qaNodes, caseConfig);
  }
  return { ...state, scores, scoreEvidence: evidence };
}

export function determineBranch(
  state: SessionState,
  caseConfig?: CaseConfig | null
): BranchPath {
  const ids = state.examsOrdered.map((e) => e.examId.toLowerCase());
  const logs = state.eventLog || [];
  const events = caseConfig?.clinicalEvents || [];
  const eventOkRatio =
    events.length === 0
      ? 1
      : logs.filter((l) => l.allCorrect || l.avoided).length / events.length;

  if (isStemiCase(caseConfig)) {
    const ecg = findEcgOrder(state);
    const ecgOnTime = Boolean(ecg && ecg.orderedAtMinute <= 10);
    const overChecking =
      ids.some((id) => id.includes("cta") || id.includes("ct_angio")) ||
      (ids.some((id) => id.includes("cxr") || id.includes("x线") || id.includes("e4")) &&
        ids.some((id) => id.includes("troponin") || id.includes("l1")) &&
        ids.length >= 5);
    if (!ecg || !ecgOnTime) return "B";
    if (overChecking) return "C";
    if (eventOkRatio >= 0.5 && state.unlockedQaIds.length >= 4) return "A";
    return "D";
  }

  const earlyExam = state.examsOrdered.some((e) => e.orderedAtMinute <= 15);
  const overChecking = state.examsOrdered.length >= 8;
  if (!earlyExam && state.simMinutes > 20) return "B";
  if (overChecking) return "C";
  if (earlyExam && state.unlockedQaIds.length >= 3 && eventOkRatio >= 0.5) return "A";
  return "D";
}

const RECOMMENDED_MODULES = [
  "腹痛鉴别",
  "呼吸困难分诊",
  "神经急症识别",
  "创伤 ABCDE",
] as const;

export function buildDimComments(state: SessionState): Record<keyof ScoreDimensions, string> {
  const rules = new Set(state.scoreEvidence.map((e) => e.rule));
  const s = state.scores;
  return {
    TRI: [
      rules.has("首份心电图在 10 分钟内开立") || rules.has("关键检查较早开立")
        ? "关键检查时机较好"
        : "关键检查时机不足",
      rules.has("早期开立检查") ? "已早期启动检查" : "未早期启动检查",
      rules.has("已开始系统查体") ? "已开始查体" : "查体不足",
    ].join("；"),
    INF: [
      s.INF >= 15 ? "问诊较充分" : "问诊覆盖不足",
      rules.has("社会史") ? "已含社会史" : "可补社会史",
      rules.has("安全史") ? "已含安全史" : "可补过敏/用药史",
    ].join("；"),
    DIA: [
      rules.has("完成心电图评估") || s.DIA >= 12 ? "鉴别相关检查较到位" : "鉴别相关检查不足",
      rules.has("完成心肌损伤标志物") || [...rules].some((r) => r.startsWith("鉴别相关"))
        ? "关键鉴别信息较完整"
        : "关键鉴别信息不足",
      rules.has("问诊支持鉴别诊断") ? "问诊支持鉴别" : "问诊对鉴别支持有限",
    ].join("；"),
    MAN: [
      [...rules].some((r) => r.includes("病情变化处置正确"))
        ? "病情处置正确"
        : [...rules].some((r) => r.includes("部分处置"))
          ? "病情处置部分正确"
          : "病情处置不足",
      [...rules].some((r) => r.includes("关键用药") || r.includes("关键策略"))
        ? "处置含关键用药/策略"
        : "可加强关键用药与策略选择",
    ].join("；"),
    DYN: [
      rules.has("完成全部病情波观察处置")
        ? "病程观察完整"
        : rules.has("完成半数以上病情波")
          ? "病程观察过半"
          : "病程观察不足",
      [...rules].some((r) => r.includes("动态处置"))
        ? "动态处置有回应"
        : "动态处置回应不足",
    ].join("；"),
    EBM: [
      rules.has("符合指南心电图时间窗") || rules.has("符合早期关键检查原则")
        ? "时间窗行为符合规范"
        : "时间窗行为需加强",
      rules.has("病情处置符合急危重症处理原则")
        ? "处置原则落实较好"
        : "处置原则落实不足",
    ].join("；"),
  };
}

export function buildRecommendedModules(state: SessionState): string[] {
  const tips: string[] = [];
  const rules = new Set(state.scoreEvidence.map((e) => e.rule));
  if (state.scores.DIA < 12) tips.push(RECOMMENDED_MODULES[0]);
  if (
    !rules.has("首份心电图在 10 分钟内开立") &&
    !rules.has("关键检查较早开立")
  ) {
    tips.push(RECOMMENDED_MODULES[1]);
  }
  if (state.scores.INF < 12) tips.push(RECOMMENDED_MODULES[2]);
  if (state.scores.DYN < 8 || state.scores.MAN < 10) {
    tips.push(RECOMMENDED_MODULES[3]);
  }
  const uniq = [...new Set(tips)];
  while (uniq.length < 2) {
    for (const m of RECOMMENDED_MODULES) {
      if (!uniq.includes(m)) uniq.push(m);
      if (uniq.length >= 2) break;
    }
  }
  return uniq.slice(0, 4);
}

export function buildTimeline(state: SessionState) {
  const items: Array<{
    atMinute: number;
    nodeId: string;
    label: string;
    ok: boolean;
    note: string;
  }> = [];

  for (const exam of state.examsOrdered) {
    const isEcg =
      exam.examId.toLowerCase().includes("ecg") ||
      exam.examId.toLowerCase() === "e1";
    items.push({
      atMinute: exam.orderedAtMinute,
      nodeId: exam.examId.toUpperCase(),
      label: isEcg ? "开立首份心电图" : `开立检查 ${exam.examId}`,
      ok: !isEcg || exam.orderedAtMinute <= 10,
      note: isEcg
        ? exam.orderedAtMinute <= 10
          ? "时间窗内"
          : "超时（>10 min）"
        : "已开立",
    });
  }

  for (const log of state.eventLog || []) {
    items.push({
      atMinute: log.resolvedAt ?? log.triggeredAt,
      nodeId: log.eventId,
      label: "病情变化处置",
      ok: Boolean(log.allCorrect || log.avoided),
      note: log.avoided
        ? "已避开恶化"
        : log.allCorrect
          ? "处置正确"
          : `部分正确 ${log.correctCount}/${log.totalCorrect}`,
    });
  }

  return items.sort((a, b) => a.atMinute - b.atMinute || a.nodeId.localeCompare(b.nodeId));
}

/** 是否应提示心电图时间窗超时 */
export function ecgTimeoutWarning(state: SessionState): string | null {
  const ecg = findEcgOrder(state);
  if (ecg && ecg.orderedAtMinute > 10) {
    return `超时警告：首份心电图于 T+${ecg.orderedAtMinute} 开立，超过 ≤10 分钟要求，TRI 将受影响并可能进入延误结局。`;
  }
  if (!ecg && state.simMinutes > 10) {
    return `超时提醒：模拟时钟已到 T+${state.simMinutes}，仍未开立首份心电图（目标 ≤10 分钟）。`;
  }
  return null;
}

export function buildSuggestions(state: SessionState, caseConfig?: CaseConfig | null) {
  const tips: string[] = [];
  const rules = new Set(state.scoreEvidence.map((e) => e.rule));
  if (isStemiCase(caseConfig)) {
    if (!rules.has("首份心电图在 10 分钟内开立")) {
      tips.push("进入病例后优先开心电图，保证首份 ECG 在 10 分钟内。");
    }
    if (![...rules].some((r) => r.startsWith("问诊覆盖")) && !rules.has("问诊覆盖度")) {
      tips.push("补全问诊，尤其不要漏掉社会史（吸烟）和过敏用药。");
    }
    if (!rules.has("完成心肌损伤标志物") && !rules.has("完成心电图评估")) {
      tips.push("完善心电图与肌钙蛋白等鉴别相关检查。");
    }
    if (![...rules].some((r) => r.includes("病情变化处置正确"))) {
      tips.push("在检查页完成继续观察，并正确处置每一波病情变化。");
    }
    if (!rules.has("符合指南心电图时间窗")) {
      tips.push("按指南时间窗行动：先关键检查，再动态观察处置。");
    }
  } else {
    if (state.scores.TRI < 15) tips.push("尽早开立对本病最关键的检查，并完成必要查体。");
    if (state.scores.INF < 12) tips.push("继续问诊，提高病史覆盖度。");
    if (state.scores.DIA < 12) tips.push("围绕鉴别需要选择检查与查体，避免盲目堆砌。");
    if (state.scores.MAN < 12) tips.push("病情变化出现时，按急危重症原则选对处置选项。");
    if (state.scores.DYN < 8) tips.push("用「继续观察」走完病程，及时处理每一波病情变化。");
    if (state.scores.EBM < 3) tips.push("关键检查要尽早，处置选项要对齐规范做法。");
  }
  return tips.slice(0, 4);
}

export function buildDebrief(state: SessionState, caseConfig?: CaseConfig | null) {
  const branchPath = determineBranch(state, caseConfig);
  const total = round1(
    state.scores.TRI +
      state.scores.INF +
      state.scores.DIA +
      state.scores.MAN +
      state.scores.DYN +
      state.scores.EBM
  );
  const comments = buildDimComments(state);
  const recommendedModules = buildRecommendedModules(state);
  const outcomeTable = isStemiCase(caseConfig) ? STEMI_BRANCH : BRANCH_OUTCOME;
  const pathComparison = caseConfig
    ? buildPathComparison(state, caseConfig)
    : [];
  return {
    scores: state.scores,
    max: SCORE_MAX,
    total,
    branchPath,
    outcome: outcomeTable[branchPath],
    evidence: state.scoreEvidence,
    comments,
    suggestions: buildSuggestions(state, caseConfig),
    recommendedModules,
    timeline: buildTimeline(state),
    pathComparison,
    nodeReviews: [],
  };
}

export function feedbackFromDelta(before: SessionState, after: SessionState) {
  const oldRules = new Set(before.scoreEvidence.map((e) => `${e.dim}:${e.rule}`));
  const gained = after.scoreEvidence.filter((e) => !oldRules.has(`${e.dim}:${e.rule}`));
  if (gained.length === 0) return "已记录。这次没有新增得分，请对照规则补充理由或操作。";
  return gained.map((e) => `${e.dim} +${e.points}（${e.rule}）`).join("；");
}
