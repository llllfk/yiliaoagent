import type { BranchPath, SessionState } from "@/types";

/**
 * 分支判定骨架（一期按 PRD / 叙事说明书细化）
 * A 标准 | B 延误/用药错 | C 过度检查 | D 其他
 */
export function determineBranch(state: SessionState): BranchPath {
  const p2 = state.decisions.P2;
  const p5 = state.decisions.P5;
  const p6 = state.decisions.P6;

  const p2OnTime = Boolean(p2 && p2.atMinute <= 10);
  const medError = Boolean(
    p5?.reason && /华法林|warfarin/i.test(p5.reason)
  );
  const overChecking =
    state.examsOrdered.filter((e) =>
      ["cta", "echo", "mri"].includes(e.examId.toLowerCase())
    ).length > 3;

  if (!p2OnTime || medError) return "B";
  if (overChecking) return "C";
  if (p2OnTime && p6) return "A";
  return "D";
}

/** 评分引擎占位：后续按三视角说明书 4.2 逐项规则落地 */
export function recomputeScores(_state: SessionState): SessionState {
  // 框架阶段：保持现有 scores / scoreEvidence，业务迭代时在此集中计算
  return _state;
}
