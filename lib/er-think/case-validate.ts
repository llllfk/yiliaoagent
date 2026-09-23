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

  if (Array.isArray(raw.knowledgeCards)) {
    config.knowledgeCards = raw.knowledgeCards
      .filter(isRecord)
      .map((card) => ({
        title: String(card.title || "").trim(),
        items: Array.isArray(card.items)
          ? card.items.map((x) => String(x)).filter(Boolean)
          : [],
      }))
      .filter((c) => c.title && c.items.length > 0);
  }

  if (isRecord(raw.complicationTeaching)) {
    const ct = raw.complicationTeaching;
    const title = String(ct.title || "").trim();
    const signs = String(ct.signs || "").trim();
    const actions = String(ct.actions || "").trim();
    if (title && signs && actions) {
      config.complicationTeaching = {
        title,
        signs,
        actions,
        wrongMoves: ct.wrongMoves ? String(ct.wrongMoves) : undefined,
      };
    }
  }

  if (isRecord(raw.scoringHints)) {
    const sh = raw.scoringHints;
    config.scoringHints = {
      profile: sh.profile === "stemi" ? "stemi" : "generic",
      diagnosisKeywords: Array.isArray(sh.diagnosisKeywords)
        ? sh.diagnosisKeywords.map(String).filter(Boolean)
        : [],
      essentialMedNames: Array.isArray(sh.essentialMedNames)
        ? sh.essentialMedNames.map(String).filter(Boolean)
        : [],
      recommendedStrategies: Array.isArray(sh.recommendedStrategies)
        ? sh.recommendedStrategies.map(String).filter(Boolean)
        : [],
    };
  }

  if (typeof raw.category === "string") config.category = raw.category;
  if (typeof raw.source === "string") config.source = raw.source;

  if (Array.isArray(raw.standardPath)) {
    config.standardPath = raw.standardPath
      .filter(isRecord)
      .map((item, idx) => {
        const type = String(item.type || "decision") as
          | "decision"
          | "exam"
          | "event"
          | "qa";
        return {
          id: String(item.id || `sp-${idx}`),
          timeLabel: String(item.timeLabel || "").trim() || `步骤${idx + 1}`,
          standard: String(item.standard || "").trim(),
          type: ["decision", "exam", "event", "qa"].includes(type)
            ? type
            : "decision",
          decisionId: item.decisionId
            ? (String(item.decisionId) as DecisionNodeId)
            : undefined,
          examId: item.examId ? String(item.examId) : undefined,
          examIds: Array.isArray(item.examIds)
            ? item.examIds.map(String)
            : undefined,
          eventId: item.eventId ? String(item.eventId) : undefined,
          minQa:
            item.minQa === undefined || item.minQa === null
              ? undefined
              : Number(item.minQa),
          maxMinute:
            item.maxMinute === undefined || item.maxMinute === null
              ? undefined
              : Number(item.maxMinute),
        };
      })
      .filter((x) => x.standard);
  }

  if (Array.isArray(raw.clinicalEvents)) {
    config.clinicalEvents = raw.clinicalEvents
      .filter(isRecord)
      .map((ev, idx) => {
        const id = String(ev.id || `evt-${idx}`);
        const options = Array.isArray(ev.options)
          ? ev.options
              .filter(isRecord)
              .map((o, j) => ({
                id: String(o.id || `opt-${j}`),
                text: String(o.text || "").trim(),
                correct: Boolean(o.correct),
              }))
              .filter((o) => o.text)
          : [];
        return {
          id,
          title: String(ev.title || "病情变化").trim(),
          description: String(ev.description || "").trim(),
          severity: (ev.severity === "critical" ? "critical" : "warn") as
            | "warn"
            | "critical",
          afterMinute: Number(ev.afterMinute) || 0,
          afterEventId: ev.afterEventId ? String(ev.afterEventId) : undefined,
          skipIfDecisions: Array.isArray(ev.skipIfDecisions)
            ? (ev.skipIfDecisions.filter((x) =>
                DECISION_IDS.includes(x as DecisionNodeId)
              ) as DecisionNodeId[])
            : undefined,
          vitals: ev.vitals ? String(ev.vitals) : undefined,
          vitalsSnapshot: isRecord(ev.vitalsSnapshot)
            ? {
                hr: ev.vitalsSnapshot.hr as number | string | undefined,
                bp: ev.vitalsSnapshot.bp
                  ? String(ev.vitalsSnapshot.bp)
                  : undefined,
                rr: ev.vitalsSnapshot.rr as number | string | undefined,
                spo2: ev.vitalsSnapshot.spo2 as number | string | undefined,
                temp: ev.vitalsSnapshot.temp as number | string | undefined,
                pain: ev.vitalsSnapshot.pain as number | string | undefined,
                consciousness: ev.vitalsSnapshot.consciousness
                  ? String(ev.vitalsSnapshot.consciousness)
                  : undefined,
                note: ev.vitalsSnapshot.note
                  ? String(ev.vitalsSnapshot.note)
                  : undefined,
              }
            : undefined,
          options,
          resolveOk: ev.resolveOk ? String(ev.resolveOk) : undefined,
          resolveBad: ev.resolveBad ? String(ev.resolveBad) : undefined,
        };
      })
      .filter((e) => e.id && e.description && e.options.length > 0);
  }

  if (isRecord(raw.baselineVitals)) {
    const bv = raw.baselineVitals;
    config.baselineVitals = {
      hr: bv.hr as number | string | undefined,
      bp: bv.bp ? String(bv.bp) : undefined,
      rr: bv.rr as number | string | undefined,
      spo2: bv.spo2 as number | string | undefined,
      temp: bv.temp as number | string | undefined,
      pain: bv.pain as number | string | undefined,
      consciousness: bv.consciousness ? String(bv.consciousness) : undefined,
      note: bv.note ? String(bv.note) : undefined,
    };
  }

  if (Array.isArray(raw.medicationOptions)) {
    config.medicationOptions = raw.medicationOptions
      .filter(isRecord)
      .map((m, i) => ({
        id: String(m.id || `med-${i}`),
        label: String(m.label || "").trim(),
        essential: Boolean(m.essential),
        trap: Boolean(m.trap),
      }))
      .filter((m) => m.label);
  }

  if (Array.isArray(raw.strategyOptions)) {
    config.strategyOptions = raw.strategyOptions
      .filter(isRecord)
      .map((s, i) => ({
        id: String(s.id || `strat-${i}`),
        label: String(s.label || "").trim(),
        desc: s.desc ? String(s.desc) : undefined,
        recommended: Boolean(s.recommended),
        trap: Boolean(s.trap),
      }))
      .filter((s) => s.label);
  }

  if (Array.isArray(raw.debriefNodes)) {
    const allowed = new Set([
      "decision",
      "exam",
      "lab",
      "medication",
      "strategy",
      "qa",
      "event",
      "physical",
    ]);
    config.debriefNodes = raw.debriefNodes
      .filter(isRecord)
      .map((n, i) => {
        const type = String(n.type || "decision");
        return {
          id: String(n.id || `dn-${i}`),
          title: String(n.title || n.node || "").trim(),
          type: (allowed.has(type) ? type : "decision") as
            | "decision"
            | "exam"
            | "lab"
            | "medication"
            | "strategy"
            | "qa"
            | "event"
            | "physical",
          evidence: String(n.evidence || "").trim(),
          correctComment: String(n.correctComment || "").trim(),
          wrongComment: String(n.wrongComment || "").trim(),
          decisionId: n.decisionId
            ? (String(n.decisionId) as DecisionNodeId)
            : undefined,
          examId: n.examId ? String(n.examId) : undefined,
          examIds: Array.isArray(n.examIds) ? n.examIds.map(String) : undefined,
          eventId: n.eventId ? String(n.eventId) : undefined,
          strategyId: n.strategyId ? String(n.strategyId) : undefined,
          physicalKeys: Array.isArray(n.physicalKeys)
            ? n.physicalKeys.map(String)
            : undefined,
          medTokens: Array.isArray(n.medTokens)
            ? n.medTokens.map(String)
            : undefined,
          minQa:
            n.minQa === undefined || n.minQa === null
              ? undefined
              : Number(n.minQa),
          maxMinute:
            n.maxMinute === undefined || n.maxMinute === null
              ? undefined
              : Number(n.maxMinute),
        };
      })
      .filter((n) => n.title && n.evidence && n.correctComment && n.wrongComment);
  }

  return { ok: true, config, warnings };
}
