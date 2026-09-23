import type {
  BranchPath,
  CaseConfig,
  QaNode,
  ScoreDimensions,
  SessionState,
} from "@/types";
import { SCORE_MAX, emptyScores } from "@/types";
import { buildNodeReviews } from "@/lib/er-think/node-debrief";
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
    text: "关键决策不完整或策略不当，需复盘问诊覆盖、用药与处置选择。",
  },
};

const STEMI_BRANCH: Record<BranchPath, { title: string; text: string }> = {
  A: {
    title: "标准结局",
    text: "首份心电图在时间窗内完成，再灌注策略正确。预计 90 分钟内开通血管，无严重并发症，住院约 3 天后转出。",
  },
  B: {
    title: "延误诊治",
    text: "首份心电图超出 10 分钟时间窗，或初始用药错误（如华法林替代阿司匹林）。心肌缺血时间延长，患者出现心源性休克，转入 ICU。",
  },
  C: {
    title: "过度检查",
    text: "在 STEMI 已明确时仍加做 CTA 或胸片等非必要检查，耽误再灌注，并增加辐射与费用。",
  },
  D: {
    title: "用药陷阱 / 混合结局",
    text: "关键决策不完整（如再灌注策略不清）。需复盘时间窗、抗栓与再灌注选择。",
  },
};

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

function has(text: string, pattern: RegExp) {
  return pattern.test(text || "");
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

function scoreStemi(
  scores: ScoreDimensions,
  evidence: ScoreEvidence[],
  state: SessionState,
  qaNodes: QaNode[]
) {
  const p1 = state.decisions.P1?.reason || "";
  const p2 = state.decisions.P2;
  const p4 = state.decisions.P4?.reason || "";
  const p5 = state.decisions.P5?.reason || "";
  const p6 = state.decisions.P6?.reason || "";
  const p7 = state.decisions.P7?.reason || "";
  const p8 = state.decisions.P8?.reason || "";
  const ecg = state.examsOrdered.find((e) => e.examId.toLowerCase().includes("ecg") || e.examId === "e1");
  const delayed =
    (p2 != null && p2.atMinute > 10) || (ecg != null && ecg.orderedAtMinute > 10);
  const anyReason = Object.values(state.decisions)
    .map((d) => d?.reason || "")
    .join(" ");

  if (p1 && has(p1, /II\s*级|Ⅱ级|二级|2级|I\s*级|Ⅰ级/i)) {
    add(scores, evidence, "TRI", 5, "P1 分级正确", p1.slice(0, 80));
  }
  if (p1.length >= 8 && has(p1, /胸痛|大汗|立即|危急|处理|STEMI|心梗/i)) {
    add(scores, evidence, "TRI", 5, "P1 理由充分", p1.slice(0, 80));
  }
  if (p2 && has(p2.reason, /10\s*分钟|十分钟|时间窗|指南|D2B|D1B/i)) {
    add(scores, evidence, "TRI", 5, "P2 时间窗符合指南", p2.reason.slice(0, 80));
  }
  if (ecg && ecg.orderedAtMinute <= 10) {
    add(scores, evidence, "TRI", 5, "首份心电图在 10 分钟内开立", `T+${ecg.orderedAtMinute} 开立心电图`);
  }
  if (delayed && has(anyReason, /延误|延迟|超时/)) {
    add(scores, evidence, "TRI", 5, "延误原因已记录", "决策理由中说明了延误");
  }

  scoreInfFromQa(scores, evidence, state, qaNodes);

  if (has(p4, /STEMI|心梗|心肌梗死|ST\s*抬高|ACS|冠脉/i)) {
    add(scores, evidence, "DIA", 8, "首位诊断相关", p4.slice(0, 80));
  }
  if (has(p4, /夹层|主动脉/)) {
    add(scores, evidence, "DIA", 4, "排查主动脉夹层", p4.slice(0, 80));
  }
  if (has(p4, /肺栓塞|PE|栓塞/i)) {
    add(scores, evidence, "DIA", 3, "排查肺栓塞", p4.slice(0, 80));
  }
  if (has(p4, /胆绞痛|胆囊/)) {
    add(scores, evidence, "DIA", 2.5, "鉴别胆绞痛", p4.slice(0, 80));
  }
  if (has(p4, /反流|胃食管|烧心/)) {
    add(scores, evidence, "DIA", 2.5, "鉴别胃食管反流", p4.slice(0, 80));
  }

  let drug = 0;
  if (has(p5, /阿司匹林|aspirin/i)) drug += 4;
  if (has(p5, /替格瑞洛|氯吡格雷/)) drug += 4;
  if (has(p5, /肝素/)) drug += 4;
  if (drug > 0) {
    add(scores, evidence, "MAN", drug, "抗栓药物", p5.slice(0, 80));
  }
  if (has(p6, /PCI|介入|导管/i)) {
    const full = has(p6, /12\s*小时|90|导管室|无禁忌|优先/);
    add(scores, evidence, "MAN", full ? 8 : 5, "再灌注策略", p6.slice(0, 80));
  } else if (has(p6, /溶栓/)) {
    add(scores, evidence, "MAN", 3, "再灌注选择溶栓", p6.slice(0, 80));
  }

  if (has(p7, /15\s*分钟|术前|生命体征|复查心电图|监测/)) {
    add(scores, evidence, "DYN", 5, "术前监测频率", p7.slice(0, 80));
  }
  if (has(p7, /肌钙蛋白|2\s*小时|6\s*小时|24\s*小时|动态/)) {
    add(scores, evidence, "DYN", 5, "生物标志物动态", p7.slice(0, 80));
  }
  if (has(p7, /出血|造影剂|肾病|休克/)) {
    add(scores, evidence, "DYN", 5, "并发症预警", p7.slice(0, 80));
  }

  if (has(p8, /指南|共识/) && has(p8, /ESC|AHA|ACC|2023|20\d{2}|中国/i)) {
    add(scores, evidence, "EBM", 2, "引用指南名称与年份", p8.slice(0, 80));
  }
  if (has(p8, /90|D2B|D1B|时间目标|时间窗/i)) {
    add(scores, evidence, "EBM", 2, "复述关键时间目标", p8.slice(0, 80));
  }
  if (has(p8, /PCI|优先|溶栓|因为|依据/i)) {
    add(scores, evidence, "EBM", 1, "策略依据", p8.slice(0, 80));
  }

  scoreClinicalEvents(scores, evidence, state);
}

function scoreClinicalEvents(
  scores: ScoreDimensions,
  evidence: ScoreEvidence[],
  state: SessionState
) {
  for (const log of state.eventLog || []) {
    if (log.avoided) {
      add(scores, evidence, "DYN", 3, "及时处置避开恶化", `事件 ${log.eventId} 未触发`);
      continue;
    }
    if (log.allCorrect) {
      add(
        scores,
        evidence,
        "DYN",
        5,
        "病情变化处置正确",
        `${log.eventId} ${log.correctCount}/${log.totalCorrect}`
      );
    } else if (log.correctCount > 0) {
      add(
        scores,
        evidence,
        "DYN",
        2,
        "病情变化部分处置",
        `${log.eventId} ${log.correctCount}/${log.totalCorrect}`
      );
    }
  }
}

function scoreGeneric(
  scores: ScoreDimensions,
  evidence: ScoreEvidence[],
  state: SessionState,
  qaNodes: QaNode[],
  caseConfig?: CaseConfig | null
) {
  const hints = caseConfig?.scoringHints;
  const p1 = state.decisions.P1?.reason || "";
  const p2 = state.decisions.P2?.reason || "";
  const p4 = state.decisions.P4?.reason || "";
  const p5 = state.decisions.P5?.reason || "";
  const p6 = state.decisions.P6?.reason || "";
  const p7 = state.decisions.P7?.reason || "";
  const p8 = state.decisions.P8?.reason || "";

  if (p1 && has(p1, /I\s*级|Ⅱ级|II\s*级|III\s*级|Ⅲ级|一级|二级|三级|濒危|危急|急症/i)) {
    add(scores, evidence, "TRI", 8, "P1 分诊分级", p1.slice(0, 80));
  }
  if (p1.length >= 10) {
    add(scores, evidence, "TRI", 5, "P1 理由充分", p1.slice(0, 80));
  }
  if (p2.length >= 8) {
    add(scores, evidence, "TRI", 6, "P2 关键检查时机", p2.slice(0, 80));
  }
  if (state.examsOrdered.some((e) => e.orderedAtMinute <= 15)) {
    add(scores, evidence, "TRI", 6, "早期开立关键检查", "15 分钟内已有检查申请");
  }

  scoreInfFromQa(scores, evidence, state, qaNodes);

  const dxKeys = hints?.diagnosisKeywords?.length
    ? hints.diagnosisKeywords
    : [];
  let diaHit = 0;
  for (const kw of dxKeys) {
    if (kw && p4.includes(kw)) {
      diaHit += 1;
      add(scores, evidence, "DIA", 4, `鉴别命中：${kw}`, p4.slice(0, 80));
      if (diaHit >= 4) break;
    }
  }
  if (diaHit === 0 && p4.length >= 20) {
    add(scores, evidence, "DIA", 8, "鉴别诊断已书写", p4.slice(0, 80));
  }
  if (p4.length >= 40) {
    add(scores, evidence, "DIA", 4, "鉴别较完整", p4.slice(0, 80));
  }

  const meds = hints?.essentialMedNames || [];
  if (meds.length) {
    let hit = 0;
    for (const med of meds) {
      const token = med.replace(/[（(].*$/, "").slice(0, 4);
      if (token && p5.includes(token)) {
        hit += 1;
        add(scores, evidence, "MAN", 3, `用药：${token}`, p5.slice(0, 80));
      }
    }
    if (hit === 0 && p5.length >= 12) {
      add(scores, evidence, "MAN", 6, "已记录初始用药", p5.slice(0, 80));
    }
  } else if (p5.length >= 12) {
    add(scores, evidence, "MAN", 10, "已记录初始用药", p5.slice(0, 80));
  }

  const strategies = hints?.recommendedStrategies || [];
  let stratOk = false;
  for (const s of strategies) {
    const token = s.slice(0, 6);
    if (token && p6.includes(token)) {
      stratOk = true;
      add(scores, evidence, "MAN", 8, `策略：${token}`, p6.slice(0, 80));
      break;
    }
  }
  if (!stratOk && p6.length >= 12) {
    add(scores, evidence, "MAN", 6, "已记录关键处置策略", p6.slice(0, 80));
  }

  if (has(p7, /监测|复查|生命体征|每\s*\d+|动态|警惕|恶化|休克/)) {
    add(scores, evidence, "DYN", 8, "动态监测计划", p7.slice(0, 80));
  } else if (p7.length >= 10) {
    add(scores, evidence, "DYN", 5, "已填写监测计划", p7.slice(0, 80));
  }
  if (has(p7, /并发症|出血|感染|肾功能|气道|灌注/)) {
    add(scores, evidence, "DYN", 5, "并发症预警", p7.slice(0, 80));
  }

  if (has(p8, /指南|共识|推荐|依据/)) {
    add(scores, evidence, "EBM", 3, "循证表达", p8.slice(0, 80));
  }
  if (has(p8, /20\d{2}|ESC|AHA|SCCM|surviving|卫健委|专家/i)) {
    add(scores, evidence, "EBM", 2, "引用规范来源", p8.slice(0, 80));
  }

  scoreClinicalEvents(scores, evidence, state);
}

/** 按规则重算六维分；STEMI 用验收细则，其他病例用 generic + scoringHints */
export function recomputeScores(
  state: SessionState,
  qaNodes: QaNode[] = [],
  caseConfig?: CaseConfig | null
): SessionState {
  const scores = emptyScores();
  const evidence: ScoreEvidence[] = [];
  if (isStemiCase(caseConfig)) {
    scoreStemi(scores, evidence, state, qaNodes);
  } else {
    scoreGeneric(scores, evidence, state, qaNodes, caseConfig);
  }
  return { ...state, scores, scoreEvidence: evidence };
}

export function determineBranch(
  state: SessionState,
  caseConfig?: CaseConfig | null
): BranchPath {
  const p2 = state.decisions.P2;
  const p5 = state.decisions.P5?.reason || "";
  const p6 = state.decisions.P6?.reason || "";
  const ids = state.examsOrdered.map((e) => e.examId.toLowerCase());

  if (isStemiCase(caseConfig)) {
    const ecg = state.examsOrdered.find(
      (e) => e.examId.toLowerCase().includes("ecg") || e.examId === "e1"
    );
    const p2OnTime =
      Boolean(p2 && p2.atMinute <= 10) &&
      Boolean(ecg && ecg.orderedAtMinute <= 10);
    const medError = has(p5, /华法林|warfarin/i);
    const overChecking =
      ids.some((id) => id.includes("cta") || id.includes("ct_angio")) ||
      (ids.some((id) => id.includes("cxr") || id.includes("x线") || id.includes("e4")) &&
        ids.some((id) => id.includes("troponin") || id.includes("l1")));
    const p6Ok = has(p6, /PCI|介入|溶栓/i);
    if (!p2OnTime || medError) return "B";
    if (overChecking) return "C";
    if (!p6Ok) return "D";
    return "A";
  }

  // 通用分支：关键决策是否齐全、是否明显延误、是否堆砌检查
  const hasP1 = Boolean(state.decisions.P1);
  const hasP6 = Boolean(state.decisions.P6) && p6.length >= 8;
  const lateKey = state.examsOrdered.some((e) => e.orderedAtMinute > 30) && !hasP6;
  const overChecking = state.examsOrdered.length >= 8;
  if (lateKey || (hasP1 && !state.decisions.P2 && state.simMinutes > 25)) return "B";
  if (overChecking) return "C";
  if (hasP1 && hasP6) return "A";
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
      rules.has("P1 分级正确") ? "分诊正确" : "分诊分级未达标",
      rules.has("首份心电图在 10 分钟内开立")
        ? "心电图时机达标"
        : "首份心电图未在 10 分钟内完成",
      rules.has("延误原因已记录") ? "已记录延误原因" : "未记录延误原因",
    ].join("；"),
    INF: [
      s.INF >= 15 ? "问诊较充分" : "问诊覆盖不足",
      rules.has("社会史") ? "已含社会史" : "遗漏社会史（烟酒）",
      rules.has("安全史") ? "已含安全史" : "遗漏过敏/用药安全史",
    ].join("；"),
    DIA: [
      rules.has("首位诊断为 STEMI") ? "首位诊断到位" : "未明确 STEMI 首位",
      rules.has("排查主动脉夹层") && rules.has("排查肺栓塞")
        ? "高危鉴别到位"
        : "高危鉴别（夹层/PE）不完整",
      rules.has("鉴别胆绞痛") && rules.has("鉴别胃食管反流")
        ? "非心源性胸痛已覆盖"
        : "未覆盖胆绞痛与胃食管反流",
    ].join("；"),
    MAN: [
      rules.has("抗栓药物") ? "抗栓方案基本正确" : "抗栓药物不全或错误",
      rules.has("再灌注策略") ? "再灌注策略合理" : "再灌注策略需加强",
    ].join("；"),
    DYN: [
      rules.has("术前监测频率") ? "术前监测齐全" : "术前监测频率不足",
      rules.has("生物标志物动态") ? "标志物动态计划到位" : "生物标志物动态不足",
      rules.has("并发症预警") ? "含并发症预警" : "未含出血/造影剂肾病预警",
    ].join("；"),
    EBM: [
      rules.has("引用指南名称与年份") ? "指南引用规范" : "指南名称/年份缺失",
      rules.has("复述关键时间目标") ? "时间目标复述正确" : "未复述 D1B/90 分钟目标",
    ].join("；"),
  };
}

export function buildRecommendedModules(state: SessionState): string[] {
  const tips: string[] = [];
  const rules = new Set(state.scoreEvidence.map((e) => e.rule));
  if (!rules.has("首位诊断为 STEMI") || !rules.has("鉴别胃食管反流")) {
    tips.push(RECOMMENDED_MODULES[0]);
  }
  if (!rules.has("P1 分级正确") || !rules.has("首份心电图在 10 分钟内开立")) {
    tips.push(RECOMMENDED_MODULES[1]);
  }
  if (state.scores.DIA < 15) tips.push(RECOMMENDED_MODULES[2]);
  if (state.scores.DYN < 10 || state.scores.MAN < 16) {
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
  const NODE_NAME: Record<string, string> = {
    P1: "分诊分级",
    P2: "心电图时间窗",
    P3: "病史完整性",
    P4: "鉴别诊断",
    P5: "初始药物治疗",
    P6: "再灌注决策",
    P7: "动态监测",
    P8: "循证表达",
  };
  const items: Array<{
    atMinute: number;
    nodeId: string;
    label: string;
    ok: boolean;
    note: string;
  }> = [];

  const ecg = state.examsOrdered.find((e) => e.examId.toLowerCase() === "ecg");
  if (ecg) {
    items.push({
      atMinute: ecg.orderedAtMinute,
      nodeId: "ECG",
      label: "开立首份心电图",
      ok: ecg.orderedAtMinute <= 10,
      note: ecg.orderedAtMinute <= 10 ? "时间窗内" : "超时（>10 min）",
    });
  }

  for (const id of ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8"] as const) {
    const d = state.decisions[id];
    if (!d) continue;
    let ok = true;
    let note = "已完成";
    if (id === "P2" && d.atMinute > 10) {
      ok = false;
      note = "决策记录超时";
    }
    items.push({
      atMinute: d.atMinute,
      nodeId: id,
      label: NODE_NAME[id] || id,
      ok,
      note,
    });
  }

  return items.sort((a, b) => a.atMinute - b.atMinute || a.nodeId.localeCompare(b.nodeId));
}

/** 是否应提示心电图时间窗超时（FAT-02） */
export function ecgTimeoutWarning(state: SessionState): string | null {
  const ecg = state.examsOrdered.find((e) => e.examId.toLowerCase() === "ecg");
  if (ecg && ecg.orderedAtMinute > 10) {
    return `超时警告：首份心电图于 T+${ecg.orderedAtMinute} 开立，超过 FMC-to-ECG ≤10 分钟要求，INF/TRI 将扣分并可能进入延误结局。`;
  }
  const p2 = state.decisions.P2;
  if (p2 && p2.atMinute > 10) {
    return `超时警告：P2 心电图决策记录于 T+${p2.atMinute}，超过 10 分钟时间窗。`;
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
    if (![...rules].some((r) => r.includes("首位诊断") || r.includes("鉴别命中"))) {
      tips.push("鉴别诊断写明 STEMI，并覆盖夹层、肺栓塞和胃食管反流、胆绞痛。");
    }
    if (!rules.has("抗栓药物") || !rules.has("再灌注策略")) {
      tips.push("写清阿司匹林、替格瑞洛、肝素，以及为何优先 PCI。");
    }
    if (!rules.has("并发症预警")) {
      tips.push("监测计划加上出血和造影剂肾病。");
    }
    if (!rules.has("引用指南名称与年份") && !rules.has("循证表达")) {
      tips.push("循证表达需写出指南名称、年份和 D2B < 90 分钟。");
    }
  } else {
    if (state.scores.TRI < 15) tips.push("尽早完成分诊分级，并优先开立对本病最关键的检查。");
    if (state.scores.INF < 12) tips.push("继续问诊，提高病史覆盖度。");
    if (state.scores.DIA < 12) tips.push("鉴别诊断写清首位诊断与主要鉴别项。");
    if (state.scores.MAN < 12) tips.push("补全关键药物与处置策略，对照病例提示核对。");
    if (state.scores.DYN < 8) tips.push("写明动态监测计划与可能的病情恶化预警。");
    if (state.scores.EBM < 3) tips.push("循证表达中引用指南/共识名称与关键目标。");
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
  const nodeReviews = caseConfig ? buildNodeReviews(state, caseConfig) : [];
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
    nodeReviews,
  };
}

export function feedbackFromDelta(before: SessionState, after: SessionState) {
  const oldRules = new Set(before.scoreEvidence.map((e) => `${e.dim}:${e.rule}`));
  const gained = after.scoreEvidence.filter((e) => !oldRules.has(`${e.dim}:${e.rule}`));
  if (gained.length === 0) return "已记录。这次没有新增得分，请对照规则补充理由或操作。";
  return gained.map((e) => `${e.dim} +${e.points}（${e.rule}）`).join("；");
}
