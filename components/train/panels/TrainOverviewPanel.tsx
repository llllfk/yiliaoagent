"use client";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { VitalsPanel } from "@/components/train/VitalsPanel";
import { useTrainSession } from "@/components/train/TrainSessionContext";
import { formatWallClock } from "@/components/train/train-shared";

export function TrainOverviewPanel() {
  const {
    caseConfig,
    state,
    busy,
    wallStartedAt,
    wallNow,
    currentVitals,
    activeEvent,
    eventPicks,
    setEventPicks,
    resolveEvent,
    advanceObserve,
  } = useTrainSession();

  return (
    <div className="space-y-4 animate-fade-up">
      <Card title="病例卡" eyebrow="Case">
        <div className="space-y-2 text-sm">
          <div className="font-display text-lg leading-snug">
            {caseConfig.title}
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs text-[var(--muted)] sm:grid-cols-4">
            <div className="rounded-lg bg-[var(--panel)] px-2 py-2">
              编号
              <div className="font-mono text-[var(--ink)]">{caseConfig.code}</div>
            </div>
            <div className="rounded-lg bg-[var(--panel)] px-2 py-2">
              难度
              <div className="text-[var(--ink)]">{caseConfig.difficulty}</div>
            </div>
            <div className="rounded-lg bg-[var(--panel)] px-2 py-2">
              目标时长
              <div className="text-[var(--ink)]">{caseConfig.targetMinutes} 分钟</div>
            </div>
            <div className="rounded-lg bg-[var(--panel)] px-2 py-2">
              状态
              <div className="text-[var(--ink)]">
                {state.finished ? "已结束" : "进行中"}
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-teal-200 bg-[var(--night)] px-3 py-3 text-center">
            <div className="font-mono text-[10px] tracking-[0.2em] text-teal-300/80">
              SIM CLOCK
            </div>
            <div className="monitor-clock mt-1 text-3xl font-semibold">
              T+{state.simMinutes}
              <span className="ml-1 text-base text-teal-200/70">min</span>
            </div>
            <div className="mt-2 border-t border-teal-800/60 pt-2">
              <div className="font-mono text-[10px] tracking-[0.16em] text-teal-300/70">
                WALL
              </div>
              <div className="wall-clock font-mono text-lg text-teal-100">
                {wallStartedAt
                  ? formatWallClock(wallNow - wallStartedAt)
                  : "00:00"}
                {state.finished ? (
                  <span className="ml-1 text-xs text-teal-300/70">结束</span>
                ) : null}
              </div>
            </div>
          </div>
          {caseConfig.clinicalEvents?.length ? (
            <div className="rounded-xl border border-[var(--amber)]/40 bg-[var(--amber-soft)] px-3 py-2.5 text-[11px] leading-relaxed text-[var(--ink)]">
              <div className="mb-1 font-medium text-[var(--warn)]">
                病情会反复波动（{caseConfig.clinicalEvents.length} 波）
              </div>
              <p className="text-[var(--muted)]">
                已处理 {state.eventLog.length}/{caseConfig.clinicalEvents.length}{" "}
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
          ) : null}
          {caseConfig.clinicalEvents?.length &&
          !state.activeEventId &&
          !state.finished ? (
            <Button
              type="button"
              className="w-full text-xs sm:w-auto"
              disabled={busy}
              onClick={() => void advanceObserve()}
            >
              继续观察（推进 8 分钟）→ 触发病情变化
            </Button>
          ) : null}
        </div>
      </Card>

      {currentVitals ? <VitalsPanel resolved={currentVitals} /> : null}

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

      {caseConfig.knowledgeCards?.length ? (
        <Card title="知识点" eyebrow="Cards">
          <div className="max-h-64 space-y-3 overflow-auto text-xs leading-relaxed">
            {caseConfig.knowledgeCards.map((card) => (
              <div key={card.title}>
                <div className="mb-1 font-medium text-[var(--brand)]">
                  {card.title}
                </div>
                <ul className="list-disc space-y-1 pl-4 text-[var(--muted)]">
                  {card.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
