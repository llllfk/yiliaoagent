import type {
  CaseConfig,
  ClinicalEvent,
  MedicationOption,
  SessionState,
  StrategyOption,
  VitalSigns,
} from "@/types";

export type ResolvedVitals = {
  vitals: VitalSigns;
  severity: "stable" | "warn" | "critical";
  label: string;
  eventId?: string;
};

function asNum(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() && !Number.isNaN(Number(v))) {
    return Number(v);
  }
  return undefined;
}

/** 从查体文本粗解析基线体征 */
export function parseVitalsText(text: string): VitalSigns {
  const out: VitalSigns = { note: text };
  if (!text) return out;
  const temp = text.match(/T\s*([\d.]+)/i);
  const hr = text.match(/(?:P|HR|心率)\s*(\d+)/i);
  const rr = text.match(/(?:R|RR|呼吸)\s*(\d+)/i);
  const bp = text.match(/BP\s*([\d./]+(?:\s*mmHg)?)/i);
  const spo2 = text.match(/SpO\s*2?\s*([\d.]+)/i);
  const pain = text.match(/(?:疼痛|NRS|VAS)\s*[：:.]?\s*(\d+)/i);
  if (temp) out.temp = Number(temp[1]);
  if (hr) out.hr = Number(hr[1]);
  if (rr) out.rr = Number(rr[1]);
  if (bp) out.bp = bp[1].replace(/\s*mmHg/i, "").trim() + " mmHg";
  if (spo2) out.spo2 = Number(spo2[1]);
  if (pain) out.pain = Number(pain[1]);
  return out;
}

function normalizeVitals(raw: VitalSigns | undefined): VitalSigns {
  if (!raw) return {};
  return {
    hr: raw.hr ?? undefined,
    bp: raw.bp ? String(raw.bp) : undefined,
    rr: raw.rr ?? undefined,
    spo2: raw.spo2 ?? undefined,
    temp: raw.temp ?? undefined,
    pain: raw.pain ?? undefined,
    consciousness: raw.consciousness
      ? String(raw.consciousness)
      : undefined,
    note: raw.note ? String(raw.note) : undefined,
  };
}

export function baselineFromCase(caseConfig: CaseConfig): VitalSigns {
  if (caseConfig.baselineVitals) {
    return normalizeVitals(caseConfig.baselineVitals);
  }
  const text = caseConfig.physicalExam?.vitals || "";
  return parseVitalsText(text);
}

function eventSnapshot(ev: ClinicalEvent): VitalSigns {
  if (ev.vitalsSnapshot) return normalizeVitals(ev.vitalsSnapshot);
  if (ev.vitals) {
    const parsed = parseVitalsText(ev.vitals);
    return { ...parsed, note: ev.vitals };
  }
  return {};
}

/**
 * 当前监护显示：优先活动恶化；否则取最近一次已处置事件的体征；否则基线。
 */
export function resolveCurrentVitals(
  caseConfig: CaseConfig,
  state: SessionState
): ResolvedVitals {
  const baseline = baselineFromCase(caseConfig);
  const events = caseConfig.clinicalEvents || [];

  if (state.activeEventId) {
    const active = events.find((e) => e.id === state.activeEventId);
    if (active) {
      return {
        vitals: { ...baseline, ...eventSnapshot(active) },
        severity: active.severity === "critical" ? "critical" : "warn",
        label: active.title,
        eventId: active.id,
      };
    }
  }

  const resolved = [...(state.eventLog || [])]
    .filter((e) => !e.avoided && e.resolvedAt != null)
    .sort((a, b) => b.resolvedAt - a.resolvedAt);

  for (const log of resolved) {
    const ev = events.find((e) => e.id === log.eventId);
    if (!ev) continue;
    const snap = eventSnapshot(ev);
    if (
      snap.hr != null ||
      snap.bp ||
      snap.rr != null ||
      snap.spo2 != null ||
      snap.note
    ) {
      return {
        vitals: { ...baseline, ...snap },
        severity: log.allCorrect
          ? ev.severity === "critical"
            ? "warn"
            : "stable"
          : ev.severity === "critical"
            ? "critical"
            : "warn",
        label: log.allCorrect
          ? `${ev.title}（已处置）`
          : `${ev.title}（处置欠佳）`,
        eventId: ev.id,
      };
    }
  }

  return {
    vitals: baseline,
    severity: "stable",
    label: "入室基线",
  };
}

export function medicationOptionsFromCase(
  caseConfig: CaseConfig
): MedicationOption[] {
  if (caseConfig.medicationOptions?.length) {
    return caseConfig.medicationOptions;
  }
  const names = caseConfig.scoringHints?.essentialMedNames || [];
  return names.map((label, i) => ({
    id: `med-${i}`,
    label,
    essential: true,
  }));
}

export function strategyOptionsFromCase(
  caseConfig: CaseConfig
): StrategyOption[] {
  if (caseConfig.strategyOptions?.length) {
    return caseConfig.strategyOptions;
  }
  const names = caseConfig.scoringHints?.recommendedStrategies || [];
  const seen = new Set<string>();
  const out: StrategyOption[] = [];
  for (let i = 0; i < names.length; i++) {
    const label = names[i];
    const key = label.slice(0, 8);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      id: `strat-${i}`,
      label,
      recommended: i === 0,
    });
  }
  return out;
}

export function formatVitalValue(
  key: keyof VitalSigns,
  value: number | string | undefined
): string {
  if (value === undefined || value === null || value === "") return "—";
  if (key === "spo2") return `${value}%`;
  if (key === "hr" || key === "rr") {
    const n = asNum(value);
    return n != null ? String(n) : String(value);
  }
  if (key === "temp") {
    const n = asNum(value);
    return n != null ? `${n}℃` : String(value);
  }
  return String(value);
}
