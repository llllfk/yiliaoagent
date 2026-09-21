import type { CaseConfig, DecisionNodeId, ExamItem, QaNode } from "@/types";

const DECISION_IDS: DecisionNodeId[] = [
  "P1",
  "P2",
  "P3",
  "P4",
  "P5",
  "P6",
  "P7",
  "P8",
];

export type CaseValidationResult =
  | { ok: true; config: CaseConfig; warnings: string[] }
  | { ok: false; errors: string[] };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asString(v: unknown, field: string, errors: string[]) {
  if (typeof v !== "string" || !v.trim()) {
    errors.push(`${field} 必须是非空字符串`);
    return "";
  }
  return v.trim();
}

function validateQaNodes(raw: unknown, errors: string[]): QaNode[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    errors.push("qaNodes 必须是非空数组");
    return [];
  }
  const nodes: QaNode[] = [];
  const ids = new Set<string>();
  raw.forEach((item, idx) => {
    if (!isRecord(item)) {
      errors.push(`qaNodes[${idx}] 格式错误`);
      return;
    }
    const id = asString(item.id, `qaNodes[${idx}].id`, errors);
    const category = asString(item.category, `qaNodes[${idx}].category`, errors);
    const answer = asString(item.answer, `qaNodes[${idx}].answer`, errors);
    if (!Array.isArray(item.intents) || item.intents.length === 0) {
      errors.push(`qaNodes[${idx}].intents 必须是非空字符串数组`);
      return;
    }
    const intents = item.intents
      .map((x) => (typeof x === "string" ? x.trim() : ""))
      .filter(Boolean);
    if (intents.length === 0) {
      errors.push(`qaNodes[${idx}].intents 不能为空`);
      return;
    }
    if (id && ids.has(id)) errors.push(`qaNodes 存在重复 id: ${id}`);
    if (id) ids.add(id);
    nodes.push({
      id,
      category,
      intents,
      answer,
      critical: Boolean(item.critical),
      safety: Boolean(item.safety),
    });
  });
  return nodes;
}

function validateExams(raw: unknown, errors: string[]): ExamItem[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    errors.push("exams 必须是非空数组");
    return [];
  }
  const exams: ExamItem[] = [];
  const ids = new Set<string>();
  raw.forEach((item, idx) => {
    if (!isRecord(item)) {
      errors.push(`exams[${idx}] 格式错误`);
      return;
    }
    const id = asString(item.id, `exams[${idx}].id`, errors);
    const label = asString(item.label, `exams[${idx}].label`, errors);
    const result = asString(item.result, `exams[${idx}].result`, errors);
    const costMinutes = Number(item.costMinutes);
    if (!Number.isFinite(costMinutes) || costMinutes < 0) {
      errors.push(`exams[${idx}].costMinutes 必须是 >=0 的数字`);
      return;
    }
    if (id && ids.has(id)) errors.push(`exams 存在重复 id: ${id}`);
    if (id) ids.add(id);
    exams.push({
      id,
      label,
      costMinutes,
      result,
      critical: Boolean(item.critical),
      costFee:
        item.costFee === undefined || item.costFee === null
          ? undefined
          : Number(item.costFee),
    });
  });
  return exams;
}

function validateDecisionNodes(
  raw: unknown,
  errors: string[],
  warnings: string[]
): CaseConfig["decisionNodes"] {
  if (!Array.isArray(raw) || raw.length === 0) {
    errors.push("decisionNodes 必须是非空数组");
    return [];
  }
  const nodes: CaseConfig["decisionNodes"] = [];
  const seen = new Set<string>();
  raw.forEach((item, idx) => {
    if (!isRecord(item)) {
      errors.push(`decisionNodes[${idx}] 格式错误`);
      return;
    }
    const id = asString(item.id, `decisionNodes[${idx}].id`, errors);
    if (id && !DECISION_IDS.includes(id as DecisionNodeId)) {
      errors.push(`decisionNodes[${idx}].id 必须是 P1–P8 之一`);
      return;
    }
    if (id && seen.has(id)) errors.push(`decisionNodes 重复: ${id}`);
    if (id) seen.add(id);
    nodes.push({
      id: id as DecisionNodeId,
      name: asString(item.name, `decisionNodes[${idx}].name`, errors),
      hint: asString(item.hint, `decisionNodes[${idx}].hint`, errors),
    });
  });
  for (const must of DECISION_IDS) {
    if (!seen.has(must)) warnings.push(`建议补全决策节点 ${must}`);
  }
  return nodes;
}

/** 校验病例导入 JSON，通过则返回规范化 CaseConfig */
export function validateCaseConfig(raw: unknown): CaseValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isRecord(raw)) {
    return { ok: false, errors: ["根对象必须是 JSON 对象"] };
  }

  const code = asString(raw.code, "code", errors);
  if (code && !/^[a-zA-Z0-9][a-zA-Z0-9_-]{1,62}$/.test(code)) {
    errors.push("code 仅允许字母数字下划线中划线，长度 2–63");
  }

  const title = asString(raw.title, "title", errors);
  const difficulty = asString(raw.difficulty, "difficulty", errors);
  const targetMinutes = asString(raw.targetMinutes, "targetMinutes", errors);

  if (!isRecord(raw.patient)) {
    errors.push("patient 必须是对象");
  }

  if (!isRecord(raw.physicalExam) || Object.keys(raw.physicalExam).length === 0) {
    errors.push("physicalExam 必须是非空对象");
  }

  const qaNodes = validateQaNodes(raw.qaNodes, errors);
  const exams = validateExams(raw.exams, errors);
  const decisionNodes = validateDecisionNodes(
    raw.decisionNodes,
    errors,
    warnings
  );

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const config: CaseConfig = {
    code,
    title,
    difficulty,
    targetMinutes,
    patient: (raw.patient || {}) as Record<string, unknown>,
    qaNodes,
    exams,
    physicalExam: Object.fromEntries(
      Object.entries(raw.physicalExam as Record<string, unknown>).map(
        ([k, v]) => [k, String(v)]
      )
    ),
    decisionNodes,
  };

  return { ok: true, config, warnings };
}
