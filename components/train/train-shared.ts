import type { PathCompareRow } from "@/lib/er-think/path-compare";
import type { NodeReviewRow } from "@/lib/er-think/node-debrief";
import type { BranchPath, ScoreDimensions } from "@/types";
import { SCORE_MAX } from "@/types";

export function formatWallClock(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function toastToneFromFeedback(text: string): "ok" | "warn" | "info" {
  if (/超时|警告|延误|未新增|没有新增/.test(text)) return "warn";
  if (/\+\d+|得分|命中|已记录/.test(text)) return "ok";
  return "info";
}

export const DIM_LABEL: Record<keyof ScoreDimensions, string> = {
  TRI: "分诊与时机",
  INF: "病史采集",
  DIA: "鉴别诊断",
  MAN: "用药与处置",
  DYN: "动态监测",
  EBM: "循证表达",
};

export const PATH_LABEL: Record<BranchPath, string> = {
  A: "标准结局",
  B: "延误诊治",
  C: "过度检查",
  D: "用药陷阱 / 混合结局",
};

export type DebriefReport = {
  scores: ScoreDimensions;
  max: typeof SCORE_MAX;
  total: number;
  branchPath: BranchPath;
  outcome?: { title: string; text: string };
  evidence: Array<{
    dim: keyof ScoreDimensions;
    points: number;
    rule: string;
    evidence: string;
  }>;
  comments?: Record<keyof ScoreDimensions, string>;
  suggestions: string[];
  recommendedModules?: string[];
  timeline?: Array<{
    atMinute: number;
    nodeId: string;
    label: string;
    ok: boolean;
    note: string;
  }>;
  pathComparison?: PathCompareRow[];
  nodeReviews?: NodeReviewRow[];
};

export type OpenSession = {
  id: number;
  status: string;
  case_code: string;
  case_title: string;
};

export const DECISIONS = [
  "P1",
  "P2",
  "P3",
  "P4",
  "P5",
  "P6",
  "P7",
  "P8",
] as const;

export type DecisionId = (typeof DECISIONS)[number];

export type CaseOption = {
  id: number | null;
  code: string;
  title: string;
  difficulty?: string | null;
  targetMinutes?: string | null;
};
