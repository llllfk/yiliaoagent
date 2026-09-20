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

export type CaseConfig = {
  code: string;
  title: string;
  difficulty: string;
  targetMinutes: string;
  patient: Record<string, unknown>;
  qaNodes: QaNode[];
  exams: ExamItem[];
  physicalExam: Record<string, string>;
  decisionNodes: Array<{
    id: DecisionNodeId;
    name: string;
    hint: string;
  }>;
};

export type SessionState = {
  simMinutes: number;
  unlockedQaIds: string[];
  chat: Array<{ role: "student" | "patient" | "system"; text: string; at: string }>;
  examsOrdered: Array<{
    examId: string;
    orderedAtMinute: number;
    readyAtMinute: number;
    revealed: boolean;
  }>;
  decisions: Partial<
    Record<
      DecisionNodeId,
      { reason: string; atMinute: number; meta?: Record<string, unknown> }
    >
  >;
  fallbackMissCount: number;
  scores: ScoreDimensions;
  scoreEvidence: Array<{ dim: keyof ScoreDimensions; points: number; rule: string; evidence: string }>;
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
    decisions: {},
    fallbackMissCount: 0,
    scores: emptyScores(),
    scoreEvidence: [],
    finished: false,
  };
}
