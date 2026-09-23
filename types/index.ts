export type UserRole = "teacher" | "student";

export type AuthUser = {
  id: number;
  tenantId: number;
  username: string;
  displayName: string;
  role: UserRole;
};

export type ScoreDimensions = {
  TRI: number;
  INF: number;
  DIA: number;
  MAN: number;
  DYN: number;
  EBM: number;
};

export type ScoreMax = {
  TRI: 25;
  INF: 20;
  DIA: 20;
  MAN: 20;
  DYN: 15;
  EBM: 5;
};

export const SCORE_MAX: ScoreMax = {
  TRI: 25,
  INF: 20,
  DIA: 20,
  MAN: 20,
  DYN: 15,
  EBM: 5,
};

export type BranchPath = "A" | "B" | "C" | "D";

export type DecisionNodeId =
  | "P1"
  | "P2"
  | "P3"
  | "P4"
  | "P5"
  | "P6"
  | "P7"
  | "P8";

export type QaNode = {
  id: string;
  category: string;
  intents: string[];
  answer: string;
  critical?: boolean;
  safety?: boolean;
};

export type ExamItem = {
  id: string;
  label: string;
  costMinutes: number;
  costFee?: number;
  critical?: boolean;
  result: string;
};

export type KnowledgeCard = {
  title: string;
  items: string[];
};

export type ComplicationTeaching = {
  title: string;
  signs: string;
  actions: string;
  wrongMoves?: string;
};

export type ClinicalEventOption = {
  id: string;
  text: string;
  correct: boolean;
};

/** 结构化生命体征（监护面板） */
export type VitalSigns = {
  hr?: number | string;
  bp?: string;
  rr?: number | string;
  spo2?: number | string;
  temp?: number | string;
  pain?: number | string;
  consciousness?: string;
  note?: string;
};

export type MedicationOption = {
  id: string;
  label: string;
  /** 评分期望的核心用药 */
  essential?: boolean;
  /** 易错/陷阱选项（仍可勾选，写入理由供复盘） */
  trap?: boolean;
};

export type StrategyOption = {
  id: string;
  label: string;
  desc?: string;
  /** 本例推荐方案 */
  recommended?: boolean;
  trap?: boolean;
};

/** 复盘：逐节点教学评语（对/错 + 指南依据） */
export type DebriefNodeSpec = {
  id: string;
  title: string;
  type:
    | "decision"
    | "exam"
    | "lab"
    | "medication"
    | "strategy"
    | "qa"
    | "event"
    | "physical";
  evidence: string;
  correctComment: string;
  wrongComment: string;
  decisionId?: DecisionNodeId;
  examId?: string;
  examIds?: string[];
  eventId?: string;
  strategyId?: string;
  physicalKeys?: string[];
  medTokens?: string[];
  minQa?: number;
  maxMinute?: number;
};

/** 训练中可触发的病情波动 / 恶化 / 再恶化 */
export type ClinicalEvent = {
  id: string;
  title: string;
  description: string;
  severity: "warn" | "critical";
  /** 模拟时钟达到该分钟后可触发 */
  afterMinute: number;
  /** 需先处理完的前置事件 */
  afterEventId?: string;
  /** 若这些决策已完成，则本轮恶化被「避开」 */
  skipIfDecisions?: DecisionNodeId[];
  vitals?: string;
  /** 结构化体征，驱动监护面板变化 */
  vitalsSnapshot?: VitalSigns;
  options: ClinicalEventOption[];
  resolveOk?: string;
  resolveBad?: string;
};

/** 复盘用：标准路径步骤（对照学生操作） */
export type StandardPathStep = {
  time: string;
  standard: string;
  type:
    | "triage"
    | "exam"
    | "lab"
    | "decision"
    | "medication"
    | "strategy"
    | "event"
    | "qa";
  decisionId?: DecisionNodeId;
  examIds?: string[];
  eventId?: string;
  minQa?: number;
  /** 若设置，学生操作晚于该分钟则判定为未达标 */
  withinMinute?: number;
};

export type ScoringHints = {
  profile?: "stemi" | "generic";
  diagnosisKeywords?: string[];
  essentialMedNames?: string[];
  recommendedStrategies?: string[];
};

export type StandardPathItem = {
  id: string;
  timeLabel: string;
  standard: string;
  type: "decision" | "exam" | "event" | "qa";
  decisionId?: DecisionNodeId;
  examId?: string;
  examIds?: string[];
  eventId?: string;
  minQa?: number;
  maxMinute?: number;
};

export type CaseConfig = {
  code: string;
  title: string;
  difficulty: string;
  targetMinutes: string;
  patient: Record<string, unknown>;
  qaNodes: QaNode[];
  exams: ExamItem[];
  physicalExam: Record<string, string>;
  /** 入室基线生命体征（监护面板） */
  baselineVitals?: VitalSigns;
  /** P5 可选药物清单；缺省时由 scoringHints.essentialMedNames 生成 */
  medicationOptions?: MedicationOption[];
  /** P6 策略点选；缺省时由 scoringHints.recommendedStrategies 生成 */
  strategyOptions?: StrategyOption[];
  /** 复盘逐节点评语（可选；缺省则按病例自动生成） */
  debriefNodes?: DebriefNodeSpec[];
  decisionNodes: Array<{
    id: DecisionNodeId;
    name: string;
    hint: string;
  }>;
  knowledgeCards?: KnowledgeCard[];
  complicationTeaching?: ComplicationTeaching;
  clinicalEvents?: ClinicalEvent[];
  /** 复盘：标准路径对照（可选；缺省则按病例自动生成） */
  standardPath?: StandardPathItem[];
  scoringHints?: ScoringHints;
  category?: string;
  source?: string;
};

export type SessionEventLog = {
  eventId: string;
  triggeredAt: number;
  selectedOptionIds: string[];
  correctCount: number;
  totalCorrect: number;
  resolvedAt: number;
  avoided?: boolean;
  allCorrect?: boolean;
};

export type SessionState = {
  simMinutes: number;
  unlockedQaIds: string[];
  chat: Array<{
    role: "student" | "patient" | "system";
    text: string;
    at: string;
    qaId?: string;
    tags?: Array<"critical" | "safety">;
  }>;
  examsOrdered: Array<{
    examId: string;
    orderedAtMinute: number;
    readyAtMinute: number;
    revealed: boolean;
  }>;
  /** 已点选揭示的查体项目 key（对应 physicalExam） */
  physicalKeys: string[];
  decisions: Partial<
    Record<
      DecisionNodeId,
      { reason: string; atMinute: number; meta?: Record<string, unknown> }
    >
  >;
  fallbackMissCount: number;
  scores: ScoreDimensions;
  scoreEvidence: Array<{
    dim: keyof ScoreDimensions;
    points: number;
    rule: string;
    evidence: string;
  }>;
  /** 当前待处理的病情变化 */
  activeEventId?: string | null;
  eventLog: SessionEventLog[];
  branchPath?: BranchPath;
  finished: boolean;
};

export function emptyScores(): ScoreDimensions {
  return { TRI: 0, INF: 0, DIA: 0, MAN: 0, DYN: 0, EBM: 0 };
}

export function createInitialSessionState(): SessionState {
  return {
    simMinutes: 0,
    unlockedQaIds: [],
    chat: [],
    examsOrdered: [],
    physicalKeys: [],
    decisions: {},
    fallbackMissCount: 0,
    scores: emptyScores(),
    scoreEvidence: [],
    activeEventId: null,
    eventLog: [],
    finished: false,
  };
}
