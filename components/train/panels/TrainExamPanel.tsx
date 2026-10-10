"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useTrainSession } from "@/components/train/TrainSessionContext";
import { physicalExamLabel } from "@/lib/er-think/node-debrief";

export function TrainExamPanel() {
  const {
    sessionId,
    caseConfig,
    state,
    busy,
    activeEvent,
    physical,
    physItems,
    examResults,
    doPhysical,
    orderExam,
  } = useTrainSession();

  return (
    <div className="animate-fade-up">
      {activeEvent ? (
        <div className="mb-3 rounded-xl border border-[var(--warn)] bg-[var(--amber-soft)] px-3 py-2 text-sm text-[var(--warn)]">
          当前有未处置的病情变化，查体暂不可用。请先到{" "}
          <Link
            href={`/train/${sessionId}/overview`}
            className="underline font-medium"
          >
            概览监护
          </Link>{" "}
          处理。
        </div>
      ) : null}
      <Card title="检查区" eyebrow="Workup">
        <div className="mb-2 font-mono text-[10px] tracking-[0.14em] text-[var(--muted)]">
          查体点选
        </div>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {physItems.map((item) => {
            const done = (state.physicalKeys || []).includes(item.key);
            return (
              <button
                key={item.key}
                type="button"
                className={`preset-chip${done ? " is-done-phys" : ""}`}
                disabled={busy || state.finished || done || Boolean(activeEvent)}
                onClick={() => void doPhysical(item.key)}
              >
                {done ? "✓ " : ""}
                {item.label}
              </button>
            );
          })}
        </div>
        {physical && Object.keys(physical).length > 0 ? (
          <div className="mb-3 space-y-1 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3 text-xs">
            {Object.entries(physical).map(([k, v]) => (
              <div key={k}>
                <span className="font-medium text-[var(--brand)]">
                  {physicalExamLabel(k)}：
                </span>
                {v}
              </div>
            ))}
          </div>
        ) : (
          <p className="mb-3 text-xs text-[var(--muted)]">
            点选上方项目逐项查体；每项推进模拟时钟约 1 分钟。
          </p>
        )}
        <div className="mb-3 flex flex-wrap gap-2">
          {caseConfig.exams.map((exam) => (
            <Button
              key={exam.id}
              type="button"
              variant="ghost"
              className="text-xs"
              disabled={busy || state.finished}
              onClick={() => void orderExam(exam.id)}
            >
              {exam.label}
              <span className="ml-1 font-mono text-[var(--muted)]">
                {exam.costMinutes}′
                {exam.costFee != null ? ` · ¥${exam.costFee}` : ""}
              </span>
            </Button>
          ))}
        </div>
        <div className="max-h-[420px] space-y-2 overflow-auto text-sm">
          {examResults.length === 0 ? (
            <p className="text-xs text-[var(--muted)]">尚未开立检查</p>
          ) : (
            examResults.map((r) => (
              <div
                key={r.examId}
                className={`rounded-xl border px-3 py-2.5 ${
                  r.critical && r.ready ? "crit-card" : "border-[var(--line)]"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium">
                    {r.label}
                    {r.critical && r.ready ? (
                      <span className="ml-2 font-mono text-[10px] text-[var(--crit)]">
                        CRITICAL
                      </span>
                    ) : null}
                  </div>
                  <span
                    className={`status-pill ${r.ready ? "done" : "running"}`}
                  >
                    {r.ready ? "已回报" : "等待中"}
                  </span>
                </div>
                <div className="mt-1 font-mono text-[11px] text-[var(--muted)]">
                  申请 T+{r.orderedAtMinute} · 预计 T+{r.readyAtMinute}
                </div>
                <div className="mt-1.5 text-[13px] leading-relaxed">{r.text}</div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
