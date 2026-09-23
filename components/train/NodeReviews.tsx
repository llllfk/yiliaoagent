"use client";

import type { NodeReviewRow } from "@/lib/er-think/node-debrief";

export function NodeReviews({ rows }: { rows: NodeReviewRow[] }) {
  if (!rows.length) {
    return (
      <p className="text-sm text-[var(--muted)]">暂无逐节点评语。</p>
    );
  }
  return (
    <div className="space-y-2.5">
      {rows.map((row) => (
        <div
          key={row.id}
          className={`rounded-xl border px-3 py-2.5 ${
            row.ok
              ? "border-[var(--ok)]/30 bg-[var(--ok-soft)]/50"
              : "border-[var(--amber)]/40 bg-[var(--amber-soft)]/60"
          }`}
        >
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span
              className={`status-pill ${row.ok ? "done" : "running"}`}
            >
              {row.ok ? "达标" : "待加强"}
            </span>
            <span className="text-sm font-medium">{row.title}</span>
          </div>
          <p className="text-sm leading-relaxed text-[var(--ink)]">
            {row.comment}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
            依据：{row.evidence}
          </p>
        </div>
      ))}
    </div>
  );
}
