import stemi03 from "@/data/cases/stemi-03.json";
import type { CaseConfig } from "@/types";

const CASE_MAP: Record<string, CaseConfig> = {
  "stemi-03": stemi03 as CaseConfig,
};

export function getCaseConfig(code: string): CaseConfig | null {
  return CASE_MAP[code] || null;
}

export function listCaseConfigs(): CaseConfig[] {
  return Object.values(CASE_MAP);
}
