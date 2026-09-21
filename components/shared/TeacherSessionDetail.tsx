"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { SCORE_MAX } from "@/types";

export function TeacherSessionDetail({ sessionId }: { sessionId: string }) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/sessions/${sessionId}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "加载失败");
        return;
      }
      setData(json.data.session);
    })();
  }, [sessionId]);

  if (error) {
    return (
      <p className="p-4 text-[var(--danger)]">{error}</p>
    );
  }
  if (!data) {
    return <p className="p-4 text-[var(--muted)]">加载中…</p>;
  }

  const state = (data.state || {}) as {
    chat?: Array<{ role: string; text: string }>;
    decisions?: Record<string, { reason: string; atMinute: number }>;
    scores?: Record<string, number>;
    unlockedQaIds?: string[];
    simMinutes?: number;
  };

  const scores = state.scores || {};

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 p-4 animate-fade-up">
      <Link
        href="/dashboard"
        className="w-fit text-sm font-medium text-[var(--brand)] underline-offset-2 hover:underline"
      >
        ← 返回看板
      </Link>

      <Card title="基本信息" eyebrow="Overview">
        <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["学生", String(data.student_name || "")],
            ["病例", String(data.case_title || "")],
            ["状态", String(data.status || "")],
            ["总分", String(data.score_total ?? "-")],
            ["结局", String(data.branch_path ?? "-")],
            ["模拟用时", `T+${state.simMinutes ?? 0} min`],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-[var(--panel)] px-3 py-3">
              <div className="text-xs text-[var(--muted)]">{k}</div>
              <div className="mt-1 font-medium">{v}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="六维得分" eyebrow="Scores">
        <ul className="space-y-2.5">
          {(Object.keys(SCORE_MAX) as Array<keyof typeof SCORE_MAX>).map((k) => {
            const max = SCORE_MAX[k];
            const val = Number(scores[k] || 0);
            const pct = Math.min(100, (val / max) * 100);
            return (
              <li key={k}>
                <div className="mb-1 flex justify-between font-mono text-xs">
                  <span>{k}</span>
                  <span>
                    {val}/{max}
                  </span>
                </div>
                <div className="score-bar">
                  <span style={{ width: `${pct}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="决策记录" eyebrow="Decisions">
          <div className="max-h-72 space-y-2 overflow-auto text-sm">
            {Object.keys(state.decisions || {}).length === 0 ? (
              <p className="text-[var(--muted)]">暂无决策</p>
            ) : (
              Object.entries(state.decisions || {}).map(([id, d]) => (
                <div
                  key={id}
                  className="rounded-xl border border-[var(--line)] px-3 py-2"
                >
                  <div className="font-mono text-xs text-[var(--brand)]">
                    {id} @ T+{d.atMinute}
                  </div>
                  <div className="mt-1">{d.reason}</div>
                </div>
              ))
            )}
          </div>
        </Card>
        <Card title="问诊覆盖" eyebrow="Coverage">
          <p className="text-sm leading-relaxed">
            已解锁节点：
            <span className="font-mono">
              {(state.unlockedQaIds || []).join(", ") || "无"}
            </span>
          </p>
        </Card>
      </div>

      <Card title="对话摘要" eyebrow="Transcript">
        <div className="max-h-80 space-y-2 overflow-auto text-sm">
          {(state.chat || []).length === 0 ? (
            <p className="text-[var(--muted)]">暂无对话</p>
          ) : (
            (state.chat || []).map((m, i) => (
              <div
                key={i}
                className={`rounded-xl px-3 py-2 ${
                  m.role === "student"
                    ? "chat-bubble-student"
                    : "chat-bubble-patient"
                }`}
              >
                <span className="font-mono text-[10px] text-[var(--muted)]">
                  {m.role}
                </span>
                <div>{m.text}</div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
