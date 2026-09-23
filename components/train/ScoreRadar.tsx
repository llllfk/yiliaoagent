"use client";

import type { ScoreDimensions } from "@/types";
import { SCORE_MAX } from "@/types";

const DIM_ORDER: Array<keyof ScoreDimensions> = [
  "TRI",
  "INF",
  "DIA",
  "MAN",
  "DYN",
  "EBM",
];

const DIM_SHORT: Record<keyof ScoreDimensions, string> = {
  TRI: "分诊",
  INF: "采集",
  DIA: "鉴别",
  MAN: "处置",
  DYN: "动态",
  EBM: "循证",
};

type Props = {
  scores: ScoreDimensions;
  max?: ScoreDimensions | typeof SCORE_MAX;
  size?: number;
  className?: string;
};

/** 六维能力雷达图（复盘用） */
export function ScoreRadar({
  scores,
  max = SCORE_MAX,
  size = 280,
  className = "",
}: Props) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.34;
  const n = DIM_ORDER.length;
  const angleStep = (Math.PI * 2) / n;
  const start = -Math.PI / 2;

  function point(i: number, r: number) {
    const a = start + i * angleStep;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  }

  function ringPath(ratio: number) {
    return DIM_ORDER.map((_, i) => {
      const p = point(i, radius * ratio);
      return `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    }).join(" ") + " Z";
  }

  const valuePoints = DIM_ORDER.map((k, i) => {
    const m = Number(max[k] || 1);
    const ratio = Math.max(0, Math.min(1, Number(scores[k] || 0) / m));
    return point(i, radius * ratio);
  });
  const valuePath =
    valuePoints
      .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(" ") + " Z";

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="六维能力雷达图"
    >
      {[0.25, 0.5, 0.75, 1].map((r) => (
        <path
          key={r}
          d={ringPath(r)}
          fill="none"
          stroke="var(--line)"
          strokeWidth={1}
        />
      ))}
      {DIM_ORDER.map((_, i) => {
        const p = point(i, radius);
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={p.x}
            y2={p.y}
            stroke="var(--line)"
            strokeWidth={1}
          />
        );
      })}
      <path
        d={valuePath}
        fill="rgba(15, 118, 110, 0.28)"
        stroke="var(--brand)"
        strokeWidth={2}
      />
      {valuePoints.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3.5} fill="var(--brand)" />
      ))}
      {DIM_ORDER.map((k, i) => {
        const labelR = radius + size * 0.1;
        const p = point(i, labelR);
        const val = Number(scores[k] || 0);
        const m = Number(max[k] || 0);
        return (
          <text
            key={k}
            x={p.x}
            y={p.y}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-[var(--ink)]"
            style={{ fontSize: 11, fontFamily: "var(--font-sans)" }}
          >
            <tspan x={p.x} dy="-0.35em" style={{ fontWeight: 600 }}>
              {DIM_SHORT[k]}
            </tspan>
            <tspan
              x={p.x}
              dy="1.2em"
              style={{ fontSize: 10, fill: "var(--muted)" }}
            >
              {val}/{m}
            </tspan>
          </text>
        );
      })}
    </svg>
  );
}
