"use client";

import type { PathCompareRow } from "@/lib/er-think/path-compare";

type Props = {
  rows: PathCompareRow[];
};

/** 标准路径 vs 学生实际路径对照表 */
export function PathComparison({ rows }: Props) {
  if (!rows.length) {
    return (
      <p className="text-sm text-[var(--muted)]">暂无路径对照数据。</p>
    );
  }

  const okCount = rows.filter((r) => r.correct).length;

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-sm font-medium">标准路径 vs 你的路径</div>
        <div className="font-mono text-xs text-[var(--muted)]">
          达标 {okCount}/{rows.length}
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border border-[var(--line)]">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead className="bg-[var(--panel)] text-xs text-[var(--muted)]">
            <tr>
              <th className="px-3 py-2 font-medium">时间</th>
              <th className="px-3 py-2 font-medium">标准路径</th>
              <th className="px-3 py-2 font-medium">你的操作</th>
              <th className="px-3 py-2 font-medium">判定</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--line)]">
            {rows.map((row) => (
              <tr key={row.id} className="align-top">
                <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-[var(--brand)]">
                  {row.timeLabel}
                </td>
                <td className="px-3 py-2.5 text-[13px] leading-relaxed">
                  {row.standard}
                </td>
                <td className="px-3 py-2.5 text-[13px] leading-relaxed text-[var(--muted)]">
                  {row.student}
                </td>
                <td className="px-3 py-2.5">
                  <span
                    className={`font-mono text-xs ${
                      row.correct ? "text-[var(--ok)]" : "text-[var(--warn)]"
                    }`}
                  >
                    {row.correct ? "✓ 达标" : "⚠ 偏离"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
