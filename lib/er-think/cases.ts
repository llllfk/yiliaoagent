import stemi03 from "@/data/cases/stemi-03.json";
import chestPain03 from "@/data/cases/chest-pain-03.json";
import stemiTypical01 from "@/data/cases/stemi-typical-01.json";
import organophosphate01 from "@/data/cases/organophosphate-01.json";
import appendicitis01 from "@/data/cases/appendicitis-01.json";
import abdominalPain01 from "@/data/cases/abdominal-pain-01.json";
import polytrauma01 from "@/data/cases/polytrauma-01.json";
import septicShock01 from "@/data/cases/septic-shock-01.json";
import type { CaseConfig } from "@/types";

const CASE_MAP: Record<string, CaseConfig> = {
  "stemi-03": stemi03 as CaseConfig,
  "chest-pain-03": chestPain03 as CaseConfig,
  "stemi-typical-01": stemiTypical01 as CaseConfig,
  "organophosphate-01": organophosphate01 as CaseConfig,
  "appendicitis-01": appendicitis01 as CaseConfig,
  "abdominal-pain-01": abdominalPain01 as CaseConfig,
  "polytrauma-01": polytrauma01 as CaseConfig,
  "septic-shock-01": septicShock01 as CaseConfig,
};

export function getCaseConfig(code: string): CaseConfig | null {
  return CASE_MAP[code] || null;
}

export function listCaseConfigs(): CaseConfig[] {
  return Object.values(CASE_MAP);
}
