"use client";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useTrainSession } from "@/components/train/TrainSessionContext";
import {
  DECISIONS,
  type DecisionId,
} from "@/components/train/train-shared";

export function TrainDecisionsPanel() {
  const {
    caseConfig,
    state,
    busy,
    scoreNotice,
    activeNode,
    setActiveNode,
    reason,
    setReason,
    selectedMeds,
    setSelectedMeds,
    selectedStrategy,
    setSelectedStrategy,
    medOptions,
    strategyOptions,
    submitDecision,
  } = useTrainSession();

  return (
    <div className="animate-fade-up">
      <Card title="决策节点" eyebrow="P1–P8">
        <div className="mb-3 flex flex-wrap gap-2">
          {caseConfig.decisionNodes.map((n) => {
            const done = Boolean(state.decisions[n.id]);
            return (
              <button
                key={n.id}
                type="button"
                className={`node-chip ${
                  activeNode === n.id ? "is-active" : done ? "is-done" : ""
                }`}
                onClick={() => setActiveNode(n.id as DecisionId)}
              >
                {n.id}
                {done ? " ✓" : ""}
              </button>
            );
          })}
        </div>
        <p className="mb-2 text-xs leading-relaxed text-[var(--muted)]">
          {caseConfig.decisionNodes.find((n) => n.id === activeNode)?.name}：
          {caseConfig.decisionNodes.find((n) => n.id === activeNode)?.hint}
        </p>
        {activeNode === "P5" && medOptions.length > 0 ? (
          <div className="mb-3 space-y-2">
            <div className="font-mono text-[10px] tracking-[0.14em] text-[var(--muted)]">
              用药勾选
            </div>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {medOptions.map((m) => {
                const on = selectedMeds.includes(m.id);
                return (
                  <label
                    key={m.id}
                    className={`med-option${on ? " is-on" : ""}${
                      m.trap ? " is-trap" : ""
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={on}
                      disabled={busy || state.finished}
                      onChange={() => {
                        setSelectedMeds((prev) =>
                          prev.includes(m.id)
                            ? prev.filter((x) => x !== m.id)
                            : [...prev, m.id]
                        );
                      }}
                    />
                    <span>
                      {m.label}
                      {m.essential ? (
                        <span className="ml-1 font-mono text-[10px] text-[var(--brand)]">
                          核心
                        </span>
                      ) : null}
                      {m.trap ? (
                        <span className="ml-1 font-mono text-[10px] text-[var(--amber)]">
                          慎选
                        </span>
                      ) : null}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        ) : null}
        {activeNode === "P6" && strategyOptions.length > 0 ? (
          <div className="mb-3 space-y-2">
            <div className="font-mono text-[10px] tracking-[0.14em] text-[var(--muted)]">
              策略点选
            </div>
            <div className="grid gap-1.5">
              {strategyOptions.map((s) => {
                const on = selectedStrategy === s.id;
                return (
                  <label
                    key={s.id}
                    className={`med-option${on ? " is-on" : ""}${
                      s.trap ? " is-trap" : ""
                    }`}
                  >
                    <input
                      type="radio"
                      name="strategy"
                      className="mt-0.5"
                      checked={on}
                      disabled={busy || state.finished}
                      onChange={() => setSelectedStrategy(s.id)}
                    />
                    <span>
                      <span className="font-medium">{s.label}</span>
                      {s.recommended ? (
                        <span className="ml-1 font-mono text-[10px] text-[var(--brand)]">
                          推荐
                        </span>
                      ) : null}
                      {s.trap ? (
                        <span className="ml-1 font-mono text-[10px] text-[var(--amber)]">
                          慎选
                        </span>
                      ) : null}
                      {s.desc ? (
                        <span className="mt-0.5 block text-[11px] text-[var(--muted)]">
                          {s.desc}
                        </span>
                      ) : null}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        ) : null}
        <textarea
          className="mb-2 min-h-28 w-full rounded-lg border border-[var(--line)] bg-white p-3 text-sm outline-none transition focus:border-[var(--brand-strong)] focus:ring-2 focus:ring-[var(--brand-soft)]"
          placeholder={
            activeNode === "P5" && medOptions.length > 0
              ? "可选：补充剂量调整、禁忌说明等…"
              : activeNode === "P6" && strategyOptions.length > 0
                ? "可选：补充时间窗依据、溶栓禁忌等…"
                : "填写决策理由与依据…"
          }
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          disabled={busy || state.finished}
        />
        <Button
          type="button"
          disabled={busy || state.finished}
          onClick={() => void submitDecision()}
        >
          提交 {activeNode}
        </Button>
        {scoreNotice ? (
          <p className="mt-2 text-sm leading-relaxed text-[var(--brand)]">
            {scoreNotice}
          </p>
        ) : null}
        <div className="mt-3 max-h-48 space-y-1 overflow-auto border-t border-[var(--line)] pt-3 text-xs text-[var(--muted)]">
          {DECISIONS.map((id) =>
            state.decisions[id] ? (
              <div key={id} className="font-mono">
                <span className="text-[var(--brand)]">{id}</span> @T+
                {state.decisions[id]!.atMinute}：
                {state.decisions[id]!.reason.slice(0, 48)}
              </div>
            ) : null
          )}
        </div>
      </Card>
    </div>
  );
}
