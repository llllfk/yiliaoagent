"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useTrainSession } from "@/components/train/TrainSessionContext";

export function TrainInterviewPanel() {
  const {
    sessionId,
    state,
    busy,
    activeEvent,
    input,
    setInput,
    interviewPresets,
    sendChat,
  } = useTrainSession();

  return (
    <div className="animate-fade-up">
      {activeEvent ? (
        <div className="mb-3 rounded-xl border border-[var(--warn)] bg-[var(--amber-soft)] px-3 py-2 text-sm text-[var(--warn)]">
          请先在{" "}
          <Link
            href={`/train/${sessionId}/exam`}
            className="underline font-medium"
          >
            检查
          </Link>{" "}
          页底部处置当前病情变化，再继续问诊。
        </div>
      ) : null}
      <Card title="问诊对话" eyebrow="Interview" className="flex flex-col">
        <div className="mb-3 max-h-[560px] min-h-[320px] flex-1 space-y-2 overflow-auto pr-1 text-sm">
          {state.chat.length === 0 ? (
            <div className="flex h-full min-h-[200px] items-center justify-center rounded-xl border border-dashed border-[var(--line)] bg-[var(--panel)] px-4 text-center text-[var(--muted)]">
              开始询问患者主诉，例如「哪里疼？」
            </div>
          ) : (
            state.chat.map((m, idx) => (
              <div
                key={idx}
                className={`rounded-xl px-3 py-2.5 ${
                  m.role === "student"
                    ? "chat-bubble-student ml-6"
                    : m.role === "system"
                      ? "border border-[var(--amber)] bg-[var(--amber-soft)] text-[var(--ink)]"
                      : "chat-bubble-patient mr-6"
                }`}
              >
                <div className="mb-0.5 flex flex-wrap items-center gap-2 font-mono text-[10px] tracking-wider text-[var(--muted)]">
                  <span>
                    {m.role === "student"
                      ? "YOU"
                      : m.role === "system"
                        ? "SYSTEM"
                        : "PATIENT"}
                  </span>
                  {m.tags?.includes("critical") ? (
                    <span className="rounded bg-[var(--crit-soft)] px-1.5 py-0.5 text-[var(--crit)]">
                      关键
                    </span>
                  ) : null}
                  {m.tags?.includes("safety") ? (
                    <span className="rounded bg-[var(--ok-soft)] px-1.5 py-0.5 text-[var(--ok)]">
                      SAFETY
                    </span>
                  ) : null}
                </div>
                {m.text}
              </div>
            ))
          )}
        </div>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {interviewPresets.map((p) => (
            <button
              key={p.id}
              type="button"
              className="preset-chip"
              disabled={busy || state.finished || Boolean(activeEvent)}
              title={p.text}
              onClick={() => void sendChat(p.text)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            className="min-w-0 flex-1"
            value={input}
            placeholder={
              activeEvent
                ? "请先处置病情变化…"
                : "输入问诊内容，或点上方快捷问句…"
            }
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void sendChat();
            }}
            disabled={busy || state.finished || Boolean(activeEvent)}
          />
          <Button
            type="button"
            className="shrink-0 whitespace-nowrap px-4"
            disabled={busy || state.finished || Boolean(activeEvent)}
            onClick={() => void sendChat()}
          >
            发送
          </Button>
        </div>
      </Card>
    </div>
  );
}
