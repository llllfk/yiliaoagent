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

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <Card title="筛选">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            状态
            <select
              className="mt-1 block rounded-md border border-[var(--line)] px-2 py-2"
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
              className="mt-1 block rounded-md border border-[var(--line)] px-2 py-2"
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
        {error ? <p className="mt-2 text-sm text-[var(--danger)]">{error}</p> : null}
      </Card>

      <Card title="班级训练记录">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[var(--line)] text-[var(--muted)]">
              <tr>
                <th className="py-2 pr-3">学生</th>
                <th className="py-2 pr-3">病例</th>
                <th className="py-2 pr-3">状态</th>
                <th className="py-2 pr-3">总分</th>
                <th className="py-2 pr-3">结局</th>
                <th className="py-2 pr-3">开始时间</th>
                <th className="py-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-[var(--line)]/70">
                  <td className="py-2 pr-3">
                    {r.student_name}
                    <div className="text-xs text-[var(--muted)]">{r.username}</div>
                  </td>
                  <td className="py-2 pr-3">{r.case_title}</td>
                  <td className="py-2 pr-3">{r.status}</td>
                  <td className="py-2 pr-3">{r.score_total ?? "-"}</td>
                  <td className="py-2 pr-3">{r.branch_path ?? "-"}</td>
                  <td className="py-2 pr-3">
                    {new Date(r.started_at).toLocaleString()}
                  </td>
                  <td className="py-2">
                    <Link
                      className="text-[var(--brand)] underline"
                      href={`/sessions/${r.id}`}
                    >
                      详情
                    </Link>
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td className="py-6 text-[var(--muted)]" colSpan={7}>
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
