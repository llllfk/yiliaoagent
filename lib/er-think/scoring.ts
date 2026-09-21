import type { BranchPath, QaNode, ScoreDimensions, SessionState } from "@/types";
import { SCORE_MAX, emptyScores } from "@/types";

export type ScoreEvidence = {
  dim: keyof ScoreDimensions;
  points: number;
  rule: string;
  evidence: string;
};

export const BRANCH_OUTCOME: Record<BranchPath, { title: string; text: string }> = {
  A: {
    title: "标准结局",
    text: "首份心电图在时间窗内完成，再灌注策略正确。预计 90 分钟内开通血管，无严重并发症，住院约 3 天后转出。",
  },
  B: {
    title: "延误诊治",
    text: "首份心电图超出 10 分钟时间窗，心肌缺血时间延长。患者出现心源性休克，转入 ICU，左室射血分数下降。",
  },
  C: {
    title: "过度检查",
    text: "在 STEMI 已明确时仍加做 CTA 或胸片等非必要检查，耽误再灌注，并增加辐射与费用。",
  },
  D: {
    title: "用药陷阱 / 混合结局",
    text: "关键决策不完整，或抗栓方案不当（如用华法林替代阿司匹林）。需复盘时间窗、药物和再灌注策略。",
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

function bucket(node: QaNode) {
  const c = node.category || "";
  if (c.includes("社会") || node.id === "Q16") return "social";
  if (node.safety || c.includes("安全") || node.id === "Q19") return "safety";
  if (c.includes("主诉")) return "chief";
  if (c.includes("部位")) return "site";
  if (c.includes("性质")) return "quality";
  if (c.includes("程度")) return "severity";
  if (c.includes("放射")) return "radiate";
  if (c.includes("时间")) return "time";
  if (c.includes("诱因") || c.includes("缓解")) return "trigger";
  if (c.includes("伴随")) return "assoc";
  if (c.includes("既往")) return "pmh";
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

/** 按三视角说明书逐项重算，不累加历史分，避免重复加分 */
export function recomputeScores(state: SessionState, qaNodes: QaNode[] = []): SessionState {
  const scores = emptyScores();
  const evidence: ScoreEvidence[] = [];
  const unlocked = new Set(state.unlockedQaIds);
  const p1 = state.decisions.P1?.reason || "";
  const p2 = state.decisions.P2;
  const p4 = state.decisions.P4?.reason || "";
  const p5 = state.decisions.P5?.reason || "";
  const p6 = state.decisions.P6?.reason || "";
  const p7 = state.decisions.P7?.reason || "";
  const p8 = state.decisions.P8?.reason || "";
  const ecg = state.examsOrdered.find((e) => e.examId.toLowerCase() === "ecg");
  const delayed =
    (p2 != null && p2.atMinute > 10) || (ecg != null && ecg.orderedAtMinute > 10);
  const anyReason = Object.values(state.decisions)
    .map((d) => d?.reason || "")
    .join(" ");

  if (p1 && has(p1, /II\s*级|Ⅱ级|二级|2级/i)) {
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

  const hitBuckets = new Set<string>();
  for (const node of qaNodes) {
    if (unlocked.has(node.id)) hitBuckets.add(bucket(node));
  }
  for (const name of CORE_BUCKETS) {
    if (hitBuckets.has(name)) {
      add(scores, evidence, "INF", 1.5, `问诊覆盖：${BUCKET_LABEL[name]}`, "已解锁该问诊类别");
    }
  }
  if (hitBuckets.has("other")) {
    add(scores, evidence, "INF", 1.5, "问诊覆盖：其他核心项", "已解锁未归类核心问诊");
  }
  if (hitBuckets.has("social")) {
    add(scores, evidence, "INF", 2, "社会史", "已询问烟酒等社会史");
  }
  if (hitBuckets.has("safety")) {
    add(scores, evidence, "INF", 3, "安全史", "已询问过敏或当前用药");
  }

  if (has(p4, /STEMI|心梗|心肌梗死|ST\s*抬高/i)) {
    add(scores, evidence, "DIA", 8, "首位诊断为 STEMI", p4.slice(0, 80));
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

  if (has(p7, /15\s*分钟|术前|生命体征|复查心电图/)) {
    add(scores, evidence, "DYN", 5, "术前监测频率", p7.slice(0, 80));
  }
  if (has(p7, /肌钙蛋白|2\s*小时|6\s*小时|24\s*小时/)) {
    add(scores, evidence, "DYN", 5, "生物标志物动态", p7.slice(0, 80));
  }
  if (has(p7, /出血|造影剂|肾病/)) {
    add(scores, evidence, "DYN", 5, "并发症预警", p7.slice(0, 80));
  }

  if (has(p8, /指南/) && has(p8, /ESC|AHA|ACC|2023|20\d{2}/i)) {
    add(scores, evidence, "EBM", 2, "引用指南名称与年份", p8.slice(0, 80));
  }
  if (has(p8, /90|D2B|D1B|时间目标|时间窗/i)) {
    add(scores, evidence, "EBM", 2, "复述关键时间目标", p8.slice(0, 80));
  }
  if (has(p8, /PCI|优先|溶栓|因为|依据/i)) {
    add(scores, evidence, "EBM", 1, "策略依据", p8.slice(0, 80));
  }

  return { ...state, scores, scoreEvidence: evidence };
}

export function determineBranch(state: SessionState): BranchPath {
  const p2 = state.decisions.P2;
  const p5 = state.decisions.P5?.reason || "";
  const p6 = state.decisions.P6?.reason || "";
  const ids = state.examsOrdered.map((e) => e.examId.toLowerCase());

  const p2OnTime = Boolean(p2 && p2.atMinute <= 10);
  const medError = has(p5, /华法林|warfarin/i);
  // 超声心动图是推荐检查，不计入过度检查；CTA，或胸片+肌钙蛋白同时开立，才算 Path C
  const overChecking = ids.includes("cta") || (ids.includes("cxr") && ids.includes("troponin"));
  const p6Ok = has(p6, /PCI|介入|溶栓/i);

  if (!p2OnTime) return "B";
  if (overChecking) return "C";
  if (medError || !p6Ok) return "D";
  return "A";
}

export function buildSuggestions(state: SessionState) {
  const tips: string[] = [];
  const rules = new Set(state.scoreEvidence.map((e) => e.rule));
  if (!rules.has("首份心电图在 10 分钟内开立")) {
    tips.push("进入病例后优先开心电图，保证首份 ECG 在 10 分钟内。");
  }
  if (![...rules].some((r) => r.startsWith("问诊覆盖")) || !rules.has("社会史")) {
    tips.push("补全问诊，尤其不要漏掉社会史（吸烟）和过敏用药。");
  }
  if (!rules.has("首位诊断为 STEMI") || !rules.has("鉴别胃食管反流")) {
    tips.push("鉴别诊断写明 STEMI，并覆盖夹层、肺栓塞和胃食管反流、胆绞痛。");
  }
  if (!rules.has("抗栓药物") || !rules.has("再灌注策略")) {
    tips.push("写清阿司匹林、替格瑞洛、肝素，以及为何优先 PCI。");
  }
  if (!rules.has("并发症预警")) {
    tips.push("监测计划加上出血和造影剂肾病。");
  }
  if (!rules.has("引用指南名称与年份")) {
    tips.push("循证表达需写出指南名称、年份和 D2B < 90 分钟。");
  }
  return tips.slice(0, 4);
}

export function buildDebrief(state: SessionState) {
  const branchPath = determineBranch(state);
  const total = round1(
    state.scores.TRI +
      state.scores.INF +
      state.scores.DIA +
      state.scores.MAN +
      state.scores.DYN +
      state.scores.EBM
  );
  return {
    scores: state.scores,
    max: SCORE_MAX,
    total,
    branchPath,
    outcome: BRANCH_OUTCOME[branchPath],
    evidence: state.scoreEvidence,
    suggestions: buildSuggestions(state),
  };
}

export function feedbackFromDelta(before: SessionState, after: SessionState) {
  const oldRules = new Set(before.scoreEvidence.map((e) => `${e.dim}:${e.rule}`));
  const gained = after.scoreEvidence.filter((e) => !oldRules.has(`${e.dim}:${e.rule}`));
  if (gained.length === 0) return "已记录。这次没有新增得分，请对照规则补充理由或操作。";
  return gained.map((e) => `${e.dim} +${e.points}（${e.rule}）`).join("；");
}
