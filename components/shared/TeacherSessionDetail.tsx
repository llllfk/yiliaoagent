"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";

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
    return <p className="text-[var(--danger)]">{error}</p>;
  }
  if (!data) {
    return <p className="text-[var(--muted)]">加载中…</p>;
  }

  const state = (data.state || {}) as {
    chat?: Array<{ role: string; text: string }>;
    decisions?: Record<string, { reason: string; atMinute: number }>;
    scores?: Record<string, number>;
    unlockedQaIds?: string[];
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <Link href="/dashboard" className="text-sm text-[var(--brand)] underline">
        ← 返回看板
      </Link>
      <Card title="基本信息">
        <div className="grid gap-2 text-sm md:grid-cols-2">
          <div>学生：{String(data.student_name || "")}</div>
          <div>病例：{String(data.case_title || "")}</div>
          <div>状态：{String(data.status || "")}</div>
          <div>总分：{String(data.score_total ?? "-")}</div>
          <div>结局：{String(data.branch_path ?? "-")}</div>
        </div>
      </Card>
      <Card title="六维得分">
        <pre className="overflow-auto text-xs">
          {JSON.stringify(state.scores || {}, null, 2)}
        </pre>
      </Card>
      <Card title="决策记录">
        <pre className="overflow-auto text-xs">
          {JSON.stringify(state.decisions || {}, null, 2)}
        </pre>
      </Card>
      <Card title="问诊覆盖">
        <p className="text-sm">
          已解锁节点：{(state.unlockedQaIds || []).join(", ") || "无"}
        </p>
      </Card>
      <Card title="对话摘要">
        <div className="max-h-80 space-y-2 overflow-auto text-sm">
          {(state.chat || []).map((m, i) => (
            <div key={i}>
              <span className="font-medium">{m.role}：</span>
              {m.text}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
