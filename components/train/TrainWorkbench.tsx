"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import type { CaseConfig, SessionState } from "@/types";
import { SCORE_MAX, createInitialSessionState } from "@/types";

const DECISIONS = [
  "P1",
  "P2",
  "P3",
  "P4",
  "P5",
  "P6",
  "P7",
  "P8",
] as const;

export function TrainWorkbench() {
  const [caseConfig, setCaseConfig] = useState<CaseConfig | null>(null);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [state, setState] = useState<SessionState>(createInitialSessionState());
  const [input, setInput] = useState("");
  const [reason, setReason] = useState("");
  const [activeNode, setActiveNode] = useState<(typeof DECISIONS)[number]>("P1");
  const [report, setReport] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [physical, setPhysical] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const caseRes = await fetch("/api/cases/stemi-03");
        const caseJson = await caseRes.json();
        if (!caseRes.ok) throw new Error(caseJson.error || "加载病例失败");
        const cfg = (caseJson.data.case.config || caseJson.data.case) as CaseConfig;
        setCaseConfig(cfg);

        const startRes = await fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ caseCode: "stemi-03" }),
        });
        const startJson = await startRes.json();
        if (!startRes.ok) throw new Error(startJson.error || "创建会话失败");
        setSessionId(startJson.data.sessionId);
        setState(startJson.data.state);
      } catch (e) {
        setError(e instanceof Error ? e.message : "初始化失败");
      }
    })();
  }, []);

  const examResults = useMemo(() => {
    if (!caseConfig) return [];
    return state.examsOrdered.map((o) => {
      const meta = caseConfig.exams.find((e) => e.id === o.examId);
      const ready = state.simMinutes >= o.readyAtMinute;
      return {
        ...o,
        label: meta?.label || o.examId,
        critical: meta?.critical,
        text: ready ? meta?.result || "" : "未回报",
        ready,
      };
    });
  }, [caseConfig, state]);

  async function sendChat() {
    if (!sessionId || !input.trim()) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/sessions/${sessionId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "问诊失败");
      setState(json.data.state);
      setInput("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "问诊失败");
    } finally {
      setBusy(false);
    }
  }

  async function orderExam(examId: string) {
    if (!sessionId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/exam`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "order", examId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "开立失败");
      setState(json.data.state);
    } catch (e) {
      setError(e instanceof Error ? e.message : "开立失败");
    } finally {
      setBusy(false);
    }
  }

  async function doPhysical() {
    if (!sessionId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/exam`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "physical" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "查体失败");
      setPhysical(json.data.physicalExam);
      setState(json.data.state);
    } catch (e) {
      setError(e instanceof Error ? e.message : "查体失败");
    } finally {
      setBusy(false);
    }
  }

  async function submitDecision() {
    if (!sessionId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodeId: activeNode, reason }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "决策失败");
      setState(json.data.state);
      setReason("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "决策失败");
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    if (!sessionId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/finish`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "结束失败");
      setState(json.data.state);
      setReport(json.data.report);
    } catch (e) {
      setError(e instanceof Error ? e.message : "结束失败");
    } finally {
      setBusy(false);
    }
  }

  if (!caseConfig) {
    return (
      <p className="text-[var(--muted)]">
        {error || "正在加载病例与会话…（需已配置 DATABASE_URL 并完成建表）"}
      </p>
    );
  }

  return (
    <div className="mx-auto grid max-w-[1400px] gap-4 lg:grid-cols-[240px_1fr]">
      <aside className="space-y-4">
        <Card title="病例卡">
          <div className="space-y-1 text-sm">
            <div className="font-medium">{caseConfig.title}</div>
            <div>编号：{caseConfig.code}</div>
            <div>难度：{caseConfig.difficulty}</div>
            <div>目标时长：{caseConfig.targetMinutes} 分钟</div>
            <div className="pt-2 text-lg font-semibold text-[var(--brand)]">
              模拟时钟 T+{state.simMinutes} min
            </div>
          </div>
        </Card>
        <Card title="六维得分">
          <ul className="space-y-1 text-sm">
            {(Object.keys(SCORE_MAX) as Array<keyof typeof SCORE_MAX>).map(
              (k) => (
                <li key={k} className="flex justify-between">
                  <span>{k}</span>
                  <span>
                    {state.scores[k]} / {SCORE_MAX[k]}
                  </span>
                </li>
              )
            )}
          </ul>
        </Card>
        <Button type="button" variant="danger" disabled={busy || state.finished} onClick={() => void finish()}>
          结束演练并复盘
        </Button>
        {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
      </aside>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card title="问诊对话" className="xl:col-span-1">
          <div className="mb-3 max-h-[420px] space-y-2 overflow-auto text-sm">
            {state.chat.length === 0 ? (
              <p className="text-[var(--muted)]">开始询问患者主诉…</p>
            ) : (
              state.chat.map((m, idx) => (
                <div
                  key={idx}
                  className={
                    m.role === "student"
                      ? "rounded-md bg-[var(--brand-soft)] px-3 py-2"
                      : "rounded-md bg-slate-50 px-3 py-2"
                  }
                >
                  <div className="text-xs text-[var(--muted)]">
                    {m.role === "student" ? "你" : "患者"}
                  </div>
                  {m.text}
                </div>
              ))
            )}
          </div>
          <div className="flex gap-2">
            <Input
              value={input}
              placeholder="例如：哪里疼？"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void sendChat();
              }}
              disabled={busy || state.finished}
            />
            <Button type="button" disabled={busy || state.finished} onClick={() => void sendChat()}>
              发送
            </Button>
          </div>
        </Card>

        <Card title="检查区" className="xl:col-span-1">
          <Button
            type="button"
            variant="ghost"
            className="mb-3"
            disabled={busy || state.finished}
            onClick={() => void doPhysical()}
          >
            申请查体
          </Button>
          {physical ? (
            <div className="mb-3 space-y-1 rounded-md bg-slate-50 p-3 text-xs">
              {Object.entries(physical).map(([k, v]) => (
                <div key={k}>
                  <span className="font-medium">{k}：</span>
                  {v}
                </div>
              ))}
            </div>
          ) : null}
          <div className="mb-3 flex flex-wrap gap-2">
            {caseConfig.exams.map((exam) => (
              <Button
                key={exam.id}
                type="button"
                variant="ghost"
                disabled={busy || state.finished}
                onClick={() => void orderExam(exam.id)}
              >
                {exam.label}（{exam.costMinutes}′）
              </Button>
            ))}
          </div>
          <div className="space-y-2 text-sm">
            {examResults.map((r) => (
              <div
                key={r.examId}
                className={`rounded-md border px-3 py-2 ${
                  r.critical && r.ready
                    ? "border-[var(--crit)] bg-rose-50"
                    : "border-[var(--line)]"
                }`}
              >
                <div className="font-medium">
                  {r.label}
                  {r.critical && r.ready ? " · 危急值" : ""}
                </div>
                <div className="text-xs text-[var(--muted)]">
                  申请 T+{r.orderedAtMinute} · 预计 T+{r.readyAtMinute}
                </div>
                <div className="mt-1">{r.text}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="决策 P1–P8" className="xl:col-span-1">
          <div className="mb-3 flex flex-wrap gap-2">
            {caseConfig.decisionNodes.map((n) => {
              const done = Boolean(state.decisions[n.id]);
              return (
                <button
                  key={n.id}
                  type="button"
                  className={`rounded-md px-2 py-1 text-xs ${
                    activeNode === n.id
                      ? "bg-[var(--brand)] text-white"
                      : done
                        ? "bg-emerald-100 text-emerald-900"
                        : "bg-slate-100"
                  }`}
                  onClick={() => setActiveNode(n.id)}
                >
                  {n.id} {done ? "✓" : ""}
                </button>
              );
            })}
          </div>
          <p className="mb-2 text-xs text-[var(--muted)]">
            {caseConfig.decisionNodes.find((n) => n.id === activeNode)?.hint}
          </p>
          <textarea
            className="mb-2 min-h-28 w-full rounded-md border border-[var(--line)] p-2 text-sm"
            placeholder="填写决策理由…"
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
          <div className="mt-3 space-y-1 text-xs text-[var(--muted)]">
            {DECISIONS.map((id) =>
              state.decisions[id] ? (
                <div key={id}>
                  {id} @T+{state.decisions[id]!.atMinute}：
                  {state.decisions[id]!.reason.slice(0, 40)}
                </div>
              ) : null
            )}
          </div>
        </Card>
      </div>

      {report ? (
        <Card title="复盘成绩单" className="lg:col-span-2">
          <pre className="overflow-auto text-xs">
            {JSON.stringify(report, null, 2)}
          </pre>
        </Card>
      ) : null}
    </div>
  );
}
