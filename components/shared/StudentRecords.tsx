"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";

type Row = {
  id: string;
  status: string;
  score_total: string | null;
  branch_path: string | null;
  started_at: string;
  finished_at: string | null;
  case_code: string;
  case_title: string;
};

const PATH_LABEL: Record<string, string> = {
  A: "标准结局",
  B: "延误诊治",
  C: "过度检查",
  D: "用药陷阱 / 混合结局",
};

export function StudentRecords() {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/sessions");
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "加载失败");
        return;
      }
      setRows(json.data.sessions || []);
    })();
  }, []);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 p-4 animate-fade-up">
      <div>
        <h1 className="font-display text-2xl tracking-wide">我的记录</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">查看自己做过的训练、分数和结局</p>
      </div>

      <Card title="训练记录" eyebrow="Mine">
        {error ? <p className="text-sm text-[var(--crit)]">{error}</p> : null}
        <div className="overflow-x-auto rounded-xl border border-[var(--line)]">
          <table className="data-table">
            <thead>
              <tr>
                <th>病例</th>
                <th>状态</th>
                <th>总分</th>
                <th>结局</th>
                <th>开始时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <div className="font-medium">{row.case_title}</div>
                    <div className="font-mono text-xs text-[var(--muted)]">{row.case_code}</div>
                  </td>
                  <td>
                    <span className={`status-pill ${row.status === "finished" ? "done" : "running"}`}>
                      {row.status === "finished" ? "已完成" : "进行中"}
                    </span>
                  </td>
                  <td className="font-mono">{row.score_total ?? "-"}</td>
                  <td>
                    {row.branch_path
                      ? `Path ${row.branch_path} · ${PATH_LABEL[row.branch_path] || ""}`
                      : "-"}
                  </td>
                  <td className="text-xs text-[var(--muted)]">
                    {new Date(row.started_at).toLocaleString()}
                  </td>
                  <td>
                    <Link
                      href={`/history/detail?id=${row.id}`}
                      className="text-sm font-medium text-[var(--brand)] underline-offset-2 hover:underline"
                    >
                      查看
                    </Link>
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-[var(--muted)]">
                    还没有训练记录，先去「开始训练」
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
