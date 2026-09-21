"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { downloadDebrief } from "@/lib/debrief-doc";
import { SCORE_MAX, type BranchPath, type ScoreDimensions } from "@/types";

const DIM_LABEL: Record<keyof ScoreDimensions, string> = {
  TRI: "分诊与时机",
  INF: "病史采集",
  DIA: "鉴别诊断",
  MAN: "用药与处置",
  DYN: "动态监测",
  EBM: "循证表达",
};

const PATH_LABEL: Record<string, string> = {
  A: "标准结局",
  B: "延误诊治",
  C: "过度检查",
  D: "用药陷阱 / 混合结局",
};

type Evidence = {
  dim: keyof ScoreDimensions;
  points: number;
  rule: string;
  evidence: string;
};

type Report = {
  scores?: ScoreDimensions;
  total?: number;
  branchPath?: BranchPath;
  outcome?: { title?: string; text?: string };
  evidence?: Evidence[];
  suggestions?: string[];
  max?: Record<string, number>;
};

export function StudentRecordDetail({ sessionId }: { sessionId: string }) {
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

  if (error) return <p className="p-4 text-sm text-[var(--crit)]">{error}</p>;
  if (!data) return <p className="p-4 text-sm text-[var(--muted)]">加载中…</p>;

  const state = (data.state || {}) as {
    scores?: ScoreDimensions;
    scoreEvidence?: Evidence[];
    decisions?: Record<string, { reason: string; atMinute: number }>;
    chat?: Array<{ role: string; text: string }>;
    simMinutes?: number;
    unlockedQaIds?: string[];
  };
  const report = (data.score_detail || {}) as Report;
  const scores = report.scores || state.scores || ({} as ScoreDimensions);
  const total =
    report.total ??
    (data.score_total != null ? Number(data.score_total) : null);
  const branch = String(report.branchPath || data.branch_path || "");
  const evidence = report.evidence || state.scoreEvidence || [];
  const suggestions = report.suggestions || [];

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 p-4 animate-fade-up">
      <Link
        href="/history"
        className="w-fit text-sm font-medium text-[var(--brand)] underline-offset-2 hover:underline"
      >
        ← 返回我的记录
      </Link>

      <Card title="这次训练" eyebrow="Record">
        <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["病例", String(data.case_title || "")],
            ["状态", data.status === "finished" ? "已完成" : "进行中"],
            ["总分", total == null || Number.isNaN(total) ? "-" : String(total)],
            [
              "结局",
              branch
                ? `Path ${branch} · ${report.outcome?.title || PATH_LABEL[branch] || ""}`
                : "-",
            ],
            ["模拟用时", `T+${state.simMinutes ?? 0} min`],
            ["问诊节点", (state.unlockedQaIds || []).join("、") || "无"],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-[var(--panel)] px-3 py-3">
              <div className="text-xs text-[var(--muted)]">{k}</div>
              <div className="mt-1 font-medium">{v}</div>
            </div>
          ))}
        </div>
        {report.outcome?.text ? (
          <p className="mt-3 text-sm leading-relaxed">{report.outcome.text}</p>
        ) : null}
        {data.status === "finished" ? (
          <Button
            type="button"
            variant="ghost"
            className="mt-3"
            onClick={() => downloadDebrief(report, String(data.case_title || "训练"))}
          >
            导出复盘
          </Button>
        ) : null}
      </Card>

      <Card title="六维得分" eyebrow="Scores">
        <ul className="space-y-2.5">
          {(Object.keys(SCORE_MAX) as Array<keyof ScoreDimensions>).map((k) => {
            const max = SCORE_MAX[k];
            const val = Number(scores[k] || 0);
            const pct = Math.min(100, (val / max) * 100);
            return (
              <li key={k}>
                <div className="mb-1 flex justify-between text-xs">
                  <span>
                    <span className="font-mono text-[var(--brand)]">{k}</span> {DIM_LABEL[k]}
                  </span>
                  <span className="font-mono">
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
        <Card title="得分依据" eyebrow="Evidence">
          {evidence.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">暂无加分记录</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {evidence.map((item, i) => (
                <li key={`${item.dim}-${i}`} className="rounded-xl border border-[var(--line)] px-3 py-2">
                  <div className="font-mono text-xs text-[var(--brand)]">
                    {item.dim} +{item.points} · {item.rule}
                  </div>
                  <div className="mt-1 text-[var(--muted)]">{item.evidence}</div>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="改进建议" eyebrow="Next">
          {suggestions.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">结束后才会生成建议</p>
          ) : (
            <ol className="list-decimal space-y-2 pl-5 text-sm">
              {suggestions.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      <Card title="决策记录" eyebrow="Decisions">
        {Object.keys(state.decisions || {}).length === 0 ? (
          <p className="text-sm text-[var(--muted)]">暂无决策</p>
        ) : (
          <div className="space-y-2 text-sm">
            {Object.entries(state.decisions || {}).map(([id, d]) => (
              <div key={id} className="rounded-xl border border-[var(--line)] px-3 py-2">
                <div className="font-mono text-xs text-[var(--brand)]">
                  {id} @ T+{d.atMinute}
                </div>
                <div className="mt-1">{d.reason}</div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
