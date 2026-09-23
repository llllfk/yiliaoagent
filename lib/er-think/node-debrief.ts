import type {
  CaseConfig,
  DebriefNodeSpec,
  SessionState,
} from "@/types";

export type NodeReviewRow = {
  id: string;
  title: string;
  type: DebriefNodeSpec["type"];
  ok: boolean;
  comment: string;
  evidence: string;
};

const PHYSICAL_LABELS: Record<string, string> = {
  vitals: "生命体征",
  general: "一般情况",
  bp_bilateral: "双上肢血压",
  lung: "肺部听诊",
  heart: "心脏听诊",
  vessel: "血管与四肢",
  abdomen: "腹部",
  pupils: "瞳孔",
  neuro: "神经系统",
  skin: "皮肤",
  e1: "查体项1",
  e2: "查体项2",
  e3: "查体项3",
  e4: "查体项4",
  e5: "查体项5",
  e6: "查体项6",
  e7: "查体项7",
  e8: "查体项8",
  exam1: "查体1",
  exam2: "查体2",
  exam3: "查体3",
  exam4: "查体4",
  exam5: "查体5",
  exam6: "查体6",
  exam7: "查体7",
  exam8: "查体8",
  exam9: "查体9",
  ex_general: "一般情况",
  ex_lung: "肺部",
  ex_heart: "心脏",
  ex_abdomen: "腹部",
  ex_neuro: "神经系统",
  ex_skin: "皮肤",
};

export function physicalExamLabel(key: string): string {
  return PHYSICAL_LABELS[key] || key;
}

export function physicalExamItems(caseConfig: CaseConfig) {
  return Object.keys(caseConfig.physicalExam || {}).map((key) => ({
    key,
    label: physicalExamLabel(key),
  }));
}

function hasExam(state: SessionState, examId: string) {
  return state.examsOrdered.some((e) => e.examId === examId);
}

function examOnTime(state: SessionState, examId: string, maxMinute?: number) {
  const row = state.examsOrdered.find((e) => e.examId === examId);
  if (!row) return false;
  if (maxMinute == null) return true;
  return row.orderedAtMinute <= maxMinute;
}

function decisionOk(
  state: SessionState,
  decisionId: NonNullable<DebriefNodeSpec["decisionId"]>,
  maxMinute?: number
) {
  const d = state.decisions[decisionId];
  if (!d?.reason?.trim()) return false;
  if (maxMinute != null && d.atMinute > maxMinute) return false;
  return true;
}

function medsOk(state: SessionState, tokens: string[]) {
  const p5 = state.decisions.P5?.reason || "";
  if (!tokens.length) return Boolean(p5.trim());
  let hit = 0;
  for (const t of tokens) {
    const token = t.replace(/[（(].*$/, "").slice(0, 4);
    if (token && p5.includes(token)) hit += 1;
  }
  return hit >= Math.min(2, tokens.length);
}

function strategyOk(state: SessionState, strategyId?: string, caseConfig?: CaseConfig) {
  const p6 = state.decisions.P6;
  if (!p6?.reason?.trim()) return false;
  const metaId = p6.meta?.strategyId ? String(p6.meta.strategyId) : "";
  if (strategyId) {
    if (metaId === strategyId) return true;
    const opt = caseConfig?.strategyOptions?.find((s) => s.id === strategyId);
    if (opt && p6.reason.includes(opt.label)) return true;
    return false;
  }
  const recommended = caseConfig?.strategyOptions?.find((s) => s.recommended);
  if (recommended) {
    if (metaId === recommended.id) return true;
    if (p6.reason.includes(recommended.label)) return true;
  }
  const hints = caseConfig?.scoringHints?.recommendedStrategies || [];
  return hints.some((s) => p6.reason.includes(s.slice(0, 6)));
}

function evaluateSpec(
  spec: DebriefNodeSpec,
  state: SessionState,
  caseConfig: CaseConfig
): boolean {
  switch (spec.type) {
    case "decision":
      return spec.decisionId
        ? decisionOk(state, spec.decisionId, spec.maxMinute)
        : false;
    case "exam":
    case "lab": {
      const ids =
        spec.examIds?.length
          ? spec.examIds
          : spec.examId
            ? [spec.examId]
            : [];
      if (!ids.length) return false;
      return ids.every((id) => examOnTime(state, id, spec.maxMinute));
    }
    case "medication": {
      const tokens =
        spec.medTokens?.length
          ? spec.medTokens
          : caseConfig.scoringHints?.essentialMedNames || [];
      return medsOk(state, tokens);
    }
    case "strategy":
      return strategyOk(state, spec.strategyId, caseConfig);
    case "qa": {
      const need =
        spec.minQa ??
        Math.min(6, Math.max(3, Math.ceil(caseConfig.qaNodes.length * 0.4)));
      return (state.unlockedQaIds || []).length >= need;
    }
    case "event": {
      if (!spec.eventId) return false;
      const log = (state.eventLog || []).find((e) => e.eventId === spec.eventId);
      if (!log) return false;
      if (log.avoided) return true;
      return Boolean(log.allCorrect);
    }
    case "physical": {
      const keys = spec.physicalKeys?.length
        ? spec.physicalKeys
        : Object.keys(caseConfig.physicalExam || {}).slice(0, 3);
      const done = new Set(state.physicalKeys || []);
      return keys.every((k) => done.has(k));
    }
    default:
      return false;
  }
}

/** 病例未配置时，按结构生成基础逐节点评语 */
export function defaultDebriefNodes(caseConfig: CaseConfig): DebriefNodeSpec[] {
  const nodes: DebriefNodeSpec[] = [
    {
      id: "dn-p1",
      title: "完成分诊分级（P1）",
      type: "decision",
      decisionId: "P1",
      maxMinute: 5,
      evidence: "急诊分诊应尽早识别高危表现并启动相应绿色通道。",
      correctComment: "已及时完成分诊决策。",
      wrongComment: "分诊偏晚或未填写，可能延误关键路径。",
    },
  ];

  const critical =
    caseConfig.exams.find((e) => e.critical) ||
    caseConfig.exams.find((e) => /心电图|ecg|血气/i.test(e.label + e.id));
  if (critical) {
    nodes.push({
      id: `dn-exam-${critical.id}`,
      title: `尽早开立「${critical.label}」`,
      type: "exam",
      examId: critical.id,
      maxMinute: 10,
      evidence: `${critical.label} 对本病种诊断/分层至关重要。`,
      correctComment: `已及时开立${critical.label}。`,
      wrongComment: `遗漏或延误${critical.label}会影响诊断与处置时机。`,
    });
  }

  nodes.push({
    id: "dn-qa",
    title: "覆盖核心问诊",
    type: "qa",
    minQa: Math.min(6, Math.max(3, Math.ceil(caseConfig.qaNodes.length * 0.4))),
    evidence: "系统问诊有助于抓住关键阳性史与危险分层线索。",
    correctComment: "问诊覆盖度达标。",
    wrongComment: "问诊节点偏少，病史采集不完整。",
  });

  if (Object.keys(caseConfig.physicalExam || {}).length) {
    nodes.push({
      id: "dn-phys",
      title: "完成重点查体",
      type: "physical",
      physicalKeys: Object.keys(caseConfig.physicalExam).slice(0, 4),
      evidence: "针对性查体可快速获取阳性体征并排除鉴别诊断。",
      correctComment: "已完成重点查体项目。",
      wrongComment: "查体项目不足，可能漏掉关键体征。",
    });
  }

  nodes.push(
    {
      id: "dn-p5",
      title: "初始药物治疗（P5）",
      type: "medication",
      medTokens: caseConfig.scoringHints?.essentialMedNames || [],
      evidence: "按病种规范启动关键初始药物。",
      correctComment: "用药方案覆盖核心药物。",
      wrongComment: "用药遗漏或不规范，需对照指南补齐。",
    },
    {
      id: "dn-p6",
      title: "关键处置策略（P6）",
      type: "strategy",
      strategyId: caseConfig.strategyOptions?.find((s) => s.recommended)?.id,
      evidence: "选择与时间窗匹配的关键处置策略。",
      correctComment: "策略选择符合本例推荐。",
      wrongComment: "策略偏离推荐路径，可能影响预后。",
    }
  );

  const shock = (caseConfig.clinicalEvents || []).find(
    (e) => e.severity === "critical"
  );
  if (shock) {
    nodes.push({
      id: `dn-evt-${shock.id}`,
      title: shock.title,
      type: "event",
      eventId: shock.id,
      evidence: "病程中出现恶化时需快速识别并正确处置。",
      correctComment: "恶化处置正确，体现动态监测能力。",
      wrongComment: "未正确处理病情恶化，存在安全隐患。",
    });
  }

  return nodes;
}

export function buildNodeReviews(
  state: SessionState,
  caseConfig: CaseConfig
): NodeReviewRow[] {
  const specs =
    caseConfig.debriefNodes?.length
      ? caseConfig.debriefNodes
      : defaultDebriefNodes(caseConfig);

  return specs.map((spec) => {
    const ok = evaluateSpec(spec, state, caseConfig);
    return {
      id: spec.id,
      title: spec.title,
      type: spec.type,
      ok,
      comment: ok ? spec.correctComment : spec.wrongComment,
      evidence: spec.evidence,
    };
  });
}
