import { maybeTriggerClinicalEvent } from "@/lib/er-think/clinical-events";
import { recomputeScores } from "@/lib/er-think/scoring";
import type { CaseConfig, SessionState } from "@/types";

/** 兼容旧会话缺少 event 字段 */
export function normalizeSessionState(state: SessionState): SessionState {
  return {
    ...state,
    eventLog: Array.isArray(state.eventLog) ? state.eventLog : [],
    physicalKeys: Array.isArray(state.physicalKeys) ? state.physicalKeys : [],
    activeEventId: state.activeEventId ?? null,
  };
}

/** 时钟/操作后：触发病情变化（如有）并重算六维分 */
export function commitSessionState(
  state: SessionState,
  caseConfig: CaseConfig | null | undefined
): SessionState {
  let next = normalizeSessionState(state);
  next = maybeTriggerClinicalEvent(next, caseConfig);
  next = recomputeScores(next, caseConfig?.qaNodes || [], caseConfig);
  return next;
}
