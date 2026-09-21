"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

type Row = {
  id: string;
  status: string;
  score_total: string | null;
  branch_path: string | null;
  started_at: string;
  finished_at: string | null;
  student_name: string;
  username: string;
  student_no: string | null;
  case_code: string;
  case_title: string;
};

export function TeacherDashboard() {
  const [rows, setRows] = useState<Row[]>([]);
  const [status, setStatus] = useState("");
  const [branch, setBranch] = useState("");
  const [error, setError] = useState("");

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (status) p.set("status", status);
    if (branch) p.set("branch", branch);
    return p.toString();
  }, [status, branch]);

  async function load() {
    setError("");
    const res = await fetch(`/api/teacher/sessions${query ? `?${query}` : ""}`);
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "加载失败");
      return;
    }
    setRows(json.data.sessions || []);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const finishedCount = rows.filter((r) => r.status === "finished").length;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 p-4 animate-fade-up">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl tracking-wide">教学看板</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            查看班级训练记录；新增病例请使用「病例导入」
          </p>
        </div>
        <Link href="/cases">
          <Button type="button">病例导入</Button>
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <div className="font-mono text-[10px] tracking-[0.16em] text-[var(--brand)]">
            SESSIONS
          </div>
          <div className="mt-1 font-display text-3xl">{rows.length}</div>
          <div className="text-xs text-[var(--muted)]">当前筛选记录数</div>
        </Card>
        <Card>
          <div className="font-mono text-[10px] tracking-[0.16em] text-[var(--amber)]">
            COMPLETED
          </div>
          <div className="mt-1 font-display text-3xl">{finishedCount}</div>
          <div className="text-xs text-[var(--muted)]">已完成演练</div>
        </Card>
        <Card>
          <div className="font-mono text-[10px] tracking-[0.16em] text-[var(--muted)]">
            FILTER
          </div>
          <div className="mt-1 text-sm text-[var(--ink)]">
            {status || "全部状态"} · {branch ? `Path ${branch}` : "全部结局"}
          </div>
        </Card>
      </div>

      <Card title="筛选条件" eyebrow="Filter">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            状态
            <select
              className="mt-1 block rounded-lg border border-[var(--line)] bg-white px-3 py-2"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">全部</option>
              <option value="in_progress">进行中</option>
              <option value="finished">已完成</option>
            </select>
          </label>
          <label className="text-sm">
            结局
            <select
              className="mt-1 block rounded-lg border border-[var(--line)] bg-white px-3 py-2"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
            >
              <option value="">全部</option>
              <option value="A">Path A</option>
              <option value="B">Path B</option>
              <option value="C">Path C</option>
              <option value="D">Path D</option>
            </select>
          </label>
          <Button type="button" variant="ghost" onClick={() => void load()}>
            刷新
          </Button>
        </div>
        {error ? (
          <p className="mt-2 text-sm text-[var(--danger)]">{error}</p>
        ) : null}
      </Card>

      <Card title="班级训练记录" eyebrow="Roster">
        <div className="overflow-x-auto rounded-xl border border-[var(--line)]">
          <table className="data-table">
            <thead>
              <tr>
                <th>学生</th>
                <th>病例</th>
                <th>状态</th>
                <th>总分</th>
                <th>结局</th>
                <th>开始时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div className="font-medium">{r.student_name}</div>
                    <div className="font-mono text-xs text-[var(--muted)]">
                      {r.username}
                    </div>
                  </td>
                  <td>{r.case_title}</td>
                  <td>
                    <span
                      className={`status-pill ${
                        r.status === "finished" ? "done" : "running"
                      }`}
                    >
                      {r.status === "finished" ? "已完成" : "进行中"}
                    </span>
                  </td>
                  <td className="font-mono">{r.score_total ?? "-"}</td>
                  <td className="font-mono">{r.branch_path ?? "-"}</td>
                  <td className="text-xs text-[var(--muted)]">
                    {new Date(r.started_at).toLocaleString()}
                  </td>
                  <td>
                    <Link
                      className="font-medium text-[var(--brand)] underline-offset-2 hover:underline"
                      href={`/sessions/${r.id}`}
                    >
                      详情
                    </Link>
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td className="py-8 text-[var(--muted)]" colSpan={7}>
                    暂无记录（请先用学生账号完成一次训练）
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
