"use client";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useTrainSession } from "@/components/train/TrainSessionContext";
import { physicalExamLabel } from "@/lib/er-think/node-debrief";

export function TrainExamPanel() {
  const {
    caseConfig,
    state,
    busy,
    activeEvent,
    physical,
    physItems,
    examResults,
    eventPicks,
    setEventPicks,
    doPhysical,
    orderExam,
    resolveEvent,
    advanceObserve,
  } = useTrainSession();

  return (
    <div className="space-y-4 animate-fade-up">
      <Card title="检查区" eyebrow="Workup">
        {activeEvent ? (
          <div className="mb-3 rounded-xl border border-[var(--warn)] bg-[var(--amber-soft)] px-3 py-2 text-sm text-[var(--warn)]">
            当前有未处置的病情变化，查体暂不可用。请先到下方完成病情处置。
          </div>
        ) : null}
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

      {caseConfig.clinicalEvents?.length ? (
        <Card title="继续观察与病情变化" eyebrow="Observe">
          <div className="rounded-xl border border-[var(--amber)]/40 bg-[var(--amber-soft)] px-3 py-2.5 text-[11px] leading-relaxed text-[var(--ink)]">
            <div className="mb-1 font-medium text-[var(--warn)]">
              病情会反复波动（{caseConfig.clinicalEvents.length} 波）
            </div>
            <p className="text-[var(--muted)]">
              建议先完成问诊与检查，再推进观察。已处理{" "}
              {state.eventLog.length}/{caseConfig.clinicalEvents.length}{" "}
              波。时钟随操作推进；也可点下方「继续观察」。约 T+
              {Math.min(
                ...caseConfig.clinicalEvents.map((e) => e.afterMinute)
              )}{" "}
              起出现变化，结束前须走完病程。
            </p>
            <ul className="mt-2 space-y-0.5 font-mono text-[10px] text-[var(--muted)]">
              {caseConfig.clinicalEvents.map((ev) => {
                const done = state.eventLog.some((l) => l.eventId === ev.id);
                const active = state.activeEventId === ev.id;
                return (
                  <li key={ev.id}>
                    {done ? "✓" : active ? "●" : "○"} T+{ev.afterMinute}{" "}
                    {ev.title.replace(/^病情(波动|恶化)[:：]?/, "")}
                  </li>
                );
              })}
            </ul>
          </div>
          {caseConfig.clinicalEvents.length &&
          !state.activeEventId &&
          !state.finished ? (
            <Button
              type="button"
              className="mt-3 w-full text-xs sm:w-auto"
              disabled={busy}
              onClick={() => void advanceObserve()}
            >
              继续观察（推进 8 分钟）→ 触发病情变化
            </Button>
          ) : null}
        </Card>
      ) : null}

      {activeEvent ? (
        <Card
          title={activeEvent.title}
          eyebrow={
            activeEvent.severity === "critical" ? "危急变化" : "病情波动"
          }
          className="border-[var(--crit)] bg-[var(--crit-soft)]/40"
        >
          <p className="mb-2 text-sm leading-relaxed">
            {activeEvent.description}
          </p>
          {activeEvent.vitals ? (
            <p className="mb-3 font-mono text-xs text-[var(--crit)]">
              生命体征：{activeEvent.vitals}
            </p>
          ) : null}
          <p className="mb-2 text-xs text-[var(--muted)]">
            请勾选你认为正确的处置（可多选），确认后时钟继续推进。急诊病程常反复波动，需动态评估。
          </p>
          <div className="mb-3 space-y-2">
            {activeEvent.options.map((opt) => {
              const checked = eventPicks.includes(opt.id);
              return (
                <label
                  key={opt.id}
                  className={`flex cursor-pointer items-start gap-2 rounded-xl border px-3 py-2.5 text-sm ${
                    checked
                      ? "border-[var(--brand)] bg-white"
                      : "border-[var(--line)] bg-white/70"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={checked}
                    disabled={busy || state.finished}
                    onChange={() => {
                      setEventPicks((prev) =>
                        prev.includes(opt.id)
                          ? prev.filter((x) => x !== opt.id)
                          : [...prev, opt.id]
                      );
                    }}
                  />
                  <span>{opt.text}</span>
                </label>
              );
            })}
          </div>
          <Button
            type="button"
            disabled={busy || state.finished || eventPicks.length === 0}
            onClick={() => void resolveEvent()}
          >
            提交病情处置
          </Button>
        </Card>
      ) : null}
    </div>
  );
}
