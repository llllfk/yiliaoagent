"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { downloadDebrief } from "@/lib/debrief-doc";
import type { BranchPath, CaseConfig, ScoreDimensions, SessionState } from "@/types";
import { SCORE_MAX, createInitialSessionState } from "@/types";

const DIM_LABEL: Record<keyof ScoreDimensions, string> = {
  TRI: "分诊与时机",
  INF: "病史采集",
  DIA: "鉴别诊断",
  MAN: "用药与处置",
  DYN: "动态监测",
  EBM: "循证表达",
};

const PATH_LABEL: Record<BranchPath, string> = {
  A: "标准结局",
  B: "延误诊治",
  C: "过度检查",
  D: "用药陷阱 / 混合结局",
};

type DebriefReport = {
  scores: ScoreDimensions;
  max: typeof SCORE_MAX;
  total: number;
  branchPath: BranchPath;
  outcome?: { title: string; text: string };
  evidence: Array<{ dim: keyof ScoreDimensions; points: number; rule: string; evidence: string }>;
  suggestions: string[];
};

type OpenSession = {
  id: number;
  status: string;
  case_code: string;
  case_title: string;
};

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

type CaseOption = {
  id: number | null;
  code: string;
  title: string;
  difficulty?: string | null;
  targetMinutes?: string | null;
};

export function TrainWorkbench() {
  const [caseList, setCaseList] = useState<CaseOption[]>([]);
  const [selectedCode, setSelectedCode] = useState<string>("");
  const [caseConfig, setCaseConfig] = useState<CaseConfig | null>(null);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [state, setState] = useState<SessionState>(createInitialSessionState());
  const [input, setInput] = useState("");
  const [reason, setReason] = useState("");
  const [activeNode, setActiveNode] = useState<(typeof DECISIONS)[number]>("P1");
  const [report, setReport] = useState<DebriefReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [scoreNotice, setScoreNotice] = useState("");
  const [physical, setPhysical] = useState<Record<string, string> | null>(null);
  const [openSessions, setOpenSessions] = useState<OpenSession[]>([]);

  async function loadOpenSessions() {
    const res = await fetch("/api/sessions");
    const json = await res.json();
    if (!res.ok) return;
    setOpenSessions((json.data.sessions || []) as OpenSession[]);
  }

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/cases");
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "加载病例列表失败");
        const list = (json.data.cases || []) as CaseOption[];
        setCaseList(list);
        if (list[0]) setSelectedCode(list[0].code);
        await loadOpenSessions();
      } catch (e) {
        setError(e instanceof Error ? e.message : "加载病例失败");
      }
    })();
  }, []);

  async function startSession(caseCode: string, resumeId?: number) {
    setBusy(true);
    setError("");
    setReport(null);
    setPhysical(null);
    setScoreNotice("");
    try {
      const caseRes = await fetch(`/api/cases/${encodeURIComponent(caseCode)}`);
      const caseJson = await caseRes.json();
      if (!caseRes.ok) throw new Error(caseJson.error || "加载病例失败");
      const cfg = (caseJson.data.case.config ||
        caseJson.data.case) as CaseConfig;
      setCaseConfig(cfg);

      if (resumeId) {
        const resumeRes = await fetch(`/api/sessions/${resumeId}`);
        const resumeJson = await resumeRes.json();
        if (!resumeRes.ok) throw new Error(resumeJson.error || "读取未完成训练失败");
        const session = resumeJson.data.session as {
          id: number;
          status: string;
          state: SessionState;
        };
        if (session.status !== "in_progress") {
          throw new Error("这条记录已经结束，请重新开始");
        }
        const raw = session.state as SessionState | string;
        const nextState =
          typeof raw === "string" ? (JSON.parse(raw) as SessionState) : raw;
        setSessionId(Number(session.id));
        setState(nextState);
      } else {
        const startRes = await fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ caseCode }),
        });
        const startJson = await startRes.json();
        if (!startRes.ok) throw new Error(startJson.error || "创建会话失败");
        setSessionId(startJson.data.sessionId);
        setState(startJson.data.state);
        await loadOpenSessions();
      }
      setActiveNode("P1");
      setInput("");
      setReason("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "开始训练失败");
      setCaseConfig(null);
      setSessionId(null);
    } finally {
      setBusy(false);
    }
  }

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

  const totalScore = useMemo(
    () =>
      state.scores.TRI +
      state.scores.INF +
      state.scores.DIA +
      state.scores.MAN +
      state.scores.DYN +
      state.scores.EBM,
    [state.scores]
  );

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
      if (json.data.feedback) setScoreNotice(String(json.data.feedback));
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
      if (json.data.feedback) setScoreNotice(String(json.data.feedback));
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
      setScoreNotice(String(json.data.feedback || "已记录。"));
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
      setReport(json.data.report as DebriefReport);
    } catch (e) {
      setError(e instanceof Error ? e.message : "结束失败");
    } finally {
      setBusy(false);
    }
  }

  if (!caseConfig || !sessionId) {
    return (
      <div className="mx-auto max-w-2xl p-4 animate-fade-up">
        <Card title="选择训练病例" eyebrow="Start">
          {caseList.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              {error || "暂无已发布病例，请联系教师导入并发布。"}
            </p>
          ) : (
            <div className="space-y-3">
              {caseList.map((c) => (
                <label
                  key={c.code}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 ${
                    selectedCode === c.code
                      ? "border-[var(--brand)] bg-[var(--brand-soft)]"
                      : "border-[var(--line)] bg-white"
                  }`}
                >
                  <input
                    type="radio"
                    name="case"
                    className="mt-1"
                    checked={selectedCode === c.code}
                    onChange={() => setSelectedCode(c.code)}
                  />
                  <div>
                    <div className="font-medium">{c.title}</div>
                    <div className="font-mono text-xs text-[var(--muted)]">
                      {c.code}
                      {c.difficulty ? ` · ${c.difficulty}` : ""}
                      {c.targetMinutes ? ` · ${c.targetMinutes} min` : ""}
                    </div>
                  </div>
                </label>
              ))}
              {(() => {
                const pending = openSessions.find(
                  (s) => s.case_code === selectedCode && s.status === "in_progress"
                );
                return (
                  <div className="space-y-2">
                    {pending ? (
                      <p className="text-xs leading-relaxed text-[var(--muted)]">
                        这个病例有一次还没结束的训练，可以接着做，也可以另开一次。
                      </p>
                    ) : null}
                    {pending ? (
                      <Button
                        type="button"
                        className="w-full"
                        disabled={busy || !selectedCode}
                        onClick={() => void startSession(selectedCode, Number(pending.id))}
                      >
                        {busy ? "正在进入…" : "继续上次"}
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant={pending ? "ghost" : "primary"}
                      className="w-full"
                      disabled={busy || !selectedCode}
                      onClick={() => void startSession(selectedCode)}
                    >
                      {busy ? "正在进入…" : pending ? "重新开始" : "开始训练"}
                    </Button>
                  </div>
                );
              })()}
            </div>
          )}
          {error ? (
            <p className="mt-3 text-sm text-[var(--crit)]">{error}</p>
          ) : null}
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-[1440px] gap-4 p-4 lg:grid-cols-[260px_1fr]">
      <aside className="space-y-4 animate-fade-up">
        <Card title="病例卡" eyebrow="Case">
          <div className="space-y-2 text-sm">
            <div className="font-display text-lg leading-snug">
              {caseConfig.title}
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-[var(--muted)]">
              <div className="rounded-lg bg-[var(--panel)] px-2 py-2">
                编号
                <div className="font-mono text-[var(--ink)]">{caseConfig.code}</div>
              </div>
              <div className="rounded-lg bg-[var(--panel)] px-2 py-2">
                难度
                <div className="text-[var(--ink)]">{caseConfig.difficulty}</div>
              </div>
            </div>
            <div className="text-xs text-[var(--muted)]">
              目标时长 {caseConfig.targetMinutes} 分钟
            </div>
            <div className="rounded-xl border border-teal-200 bg-[var(--night)] px-3 py-3 text-center">
              <div className="font-mono text-[10px] tracking-[0.2em] text-teal-300/80">
                SIM CLOCK
              </div>
              <div className="monitor-clock mt-1 text-3xl font-semibold">
                T+{state.simMinutes}
                <span className="ml-1 text-base text-teal-200/70">min</span>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              className="w-full text-xs"
              disabled={busy}
              onClick={() => {
                setCaseConfig(null);
                setSessionId(null);
                setState(createInitialSessionState());
                setReport(null);
                setScoreNotice("");
              }}
            >
              返回选病例
            </Button>
          </div>
        </Card>

        <Card title="六维能力" eyebrow="Score">
          <div className="mb-3 flex items-end justify-between">
            <span className="text-xs text-[var(--muted)]">实时累计</span>
            <span className="font-mono text-xl font-semibold text-[var(--brand)]">
              {totalScore}
              <span className="text-sm text-[var(--muted)]">/100</span>
            </span>
          </div>
          <ul className="space-y-2.5">
            {(Object.keys(SCORE_MAX) as Array<keyof typeof SCORE_MAX>).map(
              (k) => {
                const max = SCORE_MAX[k];
                const val = state.scores[k];
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
              }
            )}
          </ul>
          {scoreNotice ? (
            <p className="mt-3 rounded-lg bg-[var(--brand-soft)] px-2 py-2 text-xs leading-relaxed text-[var(--ink)]">
              {scoreNotice}
            </p>
          ) : null}
        </Card>

        <Button
          type="button"
          variant="danger"
          className="w-full"
          disabled={busy || state.finished}
          onClick={() => void finish()}
        >
          结束演练并复盘
        </Button>
        {error ? (
          <p className="rounded-lg bg-[var(--crit-soft)] px-3 py-2 text-sm text-[var(--crit)]">
            {error}
          </p>
        ) : null}
      </aside>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card title="问诊对话" eyebrow="Interview" className="flex flex-col">
          <div className="mb-3 max-h-[440px] min-h-[280px] flex-1 space-y-2 overflow-auto pr-1 text-sm">
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
                      : "chat-bubble-patient mr-6"
                  }`}
                >
                  <div className="mb-0.5 font-mono text-[10px] tracking-wider text-[var(--muted)]">
                    {m.role === "student" ? "YOU" : "PATIENT"}
                  </div>
                  {m.text}
                </div>
              ))
            )}
          </div>
          <div className="flex gap-2">
            <Input
              className="min-w-0 flex-1"
              value={input}
              placeholder="输入问诊内容…"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void sendChat();
              }}
              disabled={busy || state.finished}
            />
            <Button
              type="button"
              className="shrink-0 whitespace-nowrap px-4"
              disabled={busy || state.finished}
              onClick={() => void sendChat()}
            >
              发送
            </Button>
          </div>
        </Card>

        <Card title="检查区" eyebrow="Workup">
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
            <div className="mb-3 space-y-1 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3 text-xs">
              {Object.entries(physical).map(([k, v]) => (
                <div key={k}>
                  <span className="font-medium text-[var(--brand)]">{k}：</span>
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
                className="text-xs"
                disabled={busy || state.finished}
                onClick={() => void orderExam(exam.id)}
              >
                {exam.label}
                <span className="ml-1 font-mono text-[var(--muted)]">
                  {exam.costMinutes}′
                </span>
              </Button>
            ))}
          </div>
          <div className="max-h-[320px] space-y-2 overflow-auto text-sm">
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
                  <div className="mt-1.5 text-[13px] leading-relaxed">
                    {r.text}
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card title="决策节点" eyebrow="P1–P8">
          <div className="mb-3 flex flex-wrap gap-2">
            {caseConfig.decisionNodes.map((n) => {
              const done = Boolean(state.decisions[n.id]);
              return (
                <button
                  key={n.id}
                  type="button"
                  className={`node-chip ${
                    activeNode === n.id
                      ? "is-active"
                      : done
                        ? "is-done"
                        : ""
                  }`}
                  onClick={() => setActiveNode(n.id)}
                >
                  {n.id}
                  {done ? " ✓" : ""}
                </button>
              );
            })}
          </div>
          <p className="mb-2 text-xs leading-relaxed text-[var(--muted)]">
            {caseConfig.decisionNodes.find((n) => n.id === activeNode)?.name}
            ：
            {caseConfig.decisionNodes.find((n) => n.id === activeNode)?.hint}
          </p>
          <textarea
            className="mb-2 min-h-28 w-full rounded-lg border border-[var(--line)] bg-white p-3 text-sm outline-none transition focus:border-[var(--brand-strong)] focus:ring-2 focus:ring-[var(--brand-soft)]"
            placeholder="填写决策理由与依据…"
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
            <p className="mt-2 text-sm leading-relaxed text-[var(--brand)]">{scoreNotice}</p>
          ) : null}
          <div className="mt-3 max-h-36 space-y-1 overflow-auto border-t border-[var(--line)] pt-3 text-xs text-[var(--muted)]">
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

        {report ? (
          <Card
            title="复盘成绩单"
            eyebrow="Debrief"
            className="xl:col-span-3 animate-fade-up"
          >
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="font-mono text-[10px] tracking-[0.16em] text-[var(--muted)]">
                  TOTAL
                </div>
                <div className="font-display text-4xl leading-none text-[var(--brand)]">
                  {report.total}
                  <span className="ml-1 text-lg text-[var(--muted)]">/ 100</span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="rounded-xl bg-[var(--amber-soft)] px-4 py-3 text-sm">
                  <div className="text-xs text-[var(--muted)]">结局</div>
                  <div className="font-medium">
                    Path {report.branchPath} · {report.outcome?.title || PATH_LABEL[report.branchPath] || "未判定"}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => downloadDebrief(report, caseConfig.title)}
                >
                  导出复盘
                </Button>
              </div>
            </div>
            {report.outcome?.text ? (
              <p className="mb-4 text-sm leading-relaxed">{report.outcome.text}</p>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(Object.keys(SCORE_MAX) as Array<keyof ScoreDimensions>).map((k) => {
                const max = report.max?.[k] ?? SCORE_MAX[k];
                const val = report.scores?.[k] ?? 0;
                const pct = Math.min(100, (val / max) * 100);
                return (
                  <div
                    key={k}
                    className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-3"
                  >
                    <div className="flex items-baseline justify-between">
                      <div>
                        <div className="font-mono text-[11px] text-[var(--brand)]">{k}</div>
                        <div className="text-sm">{DIM_LABEL[k]}</div>
                      </div>
                      <div className="font-mono text-lg">
                        {val}
                        <span className="text-xs text-[var(--muted)]">/{max}</span>
                      </div>
                    </div>
                    <div className="score-bar mt-2">
                      <span style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div>
                <div className="mb-2 text-sm font-medium">得分依据</div>
                {report.evidence?.length ? (
                  <ul className="space-y-2 text-sm">
                    {report.evidence.map((item, i) => (
                      <li
                        key={`${item.dim}-${i}`}
                        className="rounded-xl border border-[var(--line)] px-3 py-2"
                      >
                        <div className="font-mono text-xs text-[var(--brand)]">
                          {item.dim} +{item.points} · {item.rule}
                        </div>
                        <div className="mt-1 text-[var(--muted)]">{item.evidence}</div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-[var(--muted)]">本次没有可追溯的加分记录。</p>
                )}
              </div>
              <div>
                <div className="mb-2 text-sm font-medium">改进建议</div>
                <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed">
                  {(report.suggestions || []).map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ol>
              </div>
            </div>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
