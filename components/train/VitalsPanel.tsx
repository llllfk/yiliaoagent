"use client";

import { useEffect, useState } from "react";
import type { ResolvedVitals } from "@/lib/er-think/vitals";
import { formatVitalValue } from "@/lib/er-think/vitals";

type Props = {
  resolved: ResolvedVitals;
};

const CELLS: Array<{
  key: "hr" | "bp" | "rr" | "spo2" | "temp" | "pain";
  label: string;
  unit?: string;
}> = [
  { key: "hr", label: "HR", unit: "bpm" },
  { key: "bp", label: "BP" },
  { key: "rr", label: "RR", unit: "/min" },
  { key: "spo2", label: "SpO₂" },
  { key: "temp", label: "Temp" },
  { key: "pain", label: "Pain" },
];

export function VitalsPanel({ resolved }: Props) {
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    setFlash(true);
    const t = window.setTimeout(() => setFlash(false), 900);
    return () => window.clearTimeout(t);
  }, [resolved.eventId, resolved.label, resolved.severity]);

  const tone =
    resolved.severity === "critical"
      ? "vitals-panel is-critical"
      : resolved.severity === "warn"
        ? "vitals-panel is-warn"
        : "vitals-panel is-stable";

  return (
    <div className={`${tone}${flash ? " is-flash" : ""}`}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-mono text-[10px] tracking-[0.16em] text-[var(--muted)]">
            MONITOR
          </div>
          <div className="text-sm font-medium text-[var(--ink)]">生命体征</div>
        </div>
        <span
          className={`status-pill ${
            resolved.severity === "critical"
              ? "running"
              : resolved.severity === "warn"
                ? "running"
                : "done"
          }`}
        >
          {resolved.label}
        </span>
      </div>
      <div className="vitals-grid">
        {CELLS.map((c) => {
          const raw = resolved.vitals[c.key];
          return (
            <div key={c.key} className="vitals-cell">
              <div className="vitals-label">{c.label}</div>
              <div className="vitals-value">
                {formatVitalValue(c.key, raw)}
                {c.unit && raw != null && raw !== "" ? (
                  <span className="vitals-unit">{c.unit}</span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
      {resolved.vitals.consciousness ? (
        <div className="mt-2 text-xs text-[var(--muted)]">
          意识：{resolved.vitals.consciousness}
        </div>
      ) : null}
      {resolved.vitals.note ? (
        <div className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
          {resolved.vitals.note}
        </div>
      ) : null}
    </div>
  );
}
