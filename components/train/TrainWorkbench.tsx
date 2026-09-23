"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { ToastStack, useToasts } from "@/components/ui/Toast";
import { downloadDebrief } from "@/lib/debrief-doc";
import { ecgTimeoutWarning } from "@/lib/er-think/scoring";
import type { PathCompareRow } from "@/lib/er-think/path-compare";
import { ScoreRadar } from "@/components/train/ScoreRadar";
import { PathComparison } from "@/components/train/PathComparison";
import { NodeReviews } from "@/components/train/NodeReviews";
import { VitalsPanel } from "@/components/train/VitalsPanel";
import {
  medicationOptionsFromCase,
  resolveCurrentVitals,
  strategyOptionsFromCase,
} from "@/lib/er-think/vitals";
import {
  physicalExamItems,
  physicalExamLabel,
  type NodeReviewRow,
} from "@/lib/er-think/node-debrief";
import type {
  BranchPath,
  CaseConfig,
  ClinicalEvent,
  ScoreDimensions,
  SessionState,
} from "@/types";
import { SCORE_MAX, createInitialSessionState } from "@/types";

function formatWallClock(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function toastToneFromFeedback(text: string): "ok" | "warn" | "info" {
  if (/超时|警告|延误|未新增|没有新增/.test(text)) return "warn";
  if (/\+\d+|得分|命中|已记录/.test(text)) return "ok";
  return "info";
}

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
  comments?: Record<keyof ScoreDimensions, string>;
  suggestions: string[];
  recommendedModules?: string[];
  timeline?: Array<{
    atMinute: number;
    nodeId: string;
    label: string;
    ok: boolean;
    note: string;
  }>;
  pathComparison?: PathCompareRow[];
  nodeReviews?: NodeReviewRow[];
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
  const [timeoutNotice, setTimeoutNotice] = useState("");
  const [physical, setPhysical] = useState<Record<string, string> | null>(null);
  const [openSessions, setOpenSessions] = useState<OpenSession[]>([]);
  const [eventPicks, setEventPicks] = useState<string[]>([]);
  const [selectedMeds, setSelectedMeds] = useState<string[]>([]);
  const [selectedStrategy, setSelectedStrategy] = useState<string>("");
  const [wallStartedAt, setWallStartedAt] = useState<number | null>(null);
  const [wallNow, setWallNow] = useState(() => Date.now());
  const { toasts, pushToast, dismiss } = useToasts();

  useEffect(() => {
    if (!sessionId || state.finished || !wallStartedAt) return;
    const t = window.setInterval(() => setWallNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [sessionId, state.finished, wallStartedAt]);

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
    setTimeoutNotice("");
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
        setState({
          ...createInitialSessionState(),
          ...nextState,
          eventLog: nextState.eventLog || [],
          physicalKeys: nextState.physicalKeys || [],
          activeEventId: nextState.activeEventId ?? null,
        });
        setEventPicks([]);
        const physAll = cfg.physicalExam || {};
        const keys = nextState.physicalKeys || [];
        setPhysical(
          keys.length
            ? Object.fromEntries(keys.map((k) => [k, physAll[k]]).filter(([, v]) => v))
            : null
        );
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
      setSelectedMeds([]);
      setSelectedStrategy("");
      setEventPicks([]);
      setWallStartedAt(Date.now());
      setWallNow(Date.now());
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

  const liveTimeout = useMemo(() => ecgTimeoutWarning(state), [state]);
  const shownTimeout = timeoutNotice || liveTimeout || "";

  const activeEvent: ClinicalEvent | null = useMemo(() => {
    if (!caseConfig?.clinicalEvents || !state.activeEventId) return null;
    return (
      caseConfig.clinicalEvents.find((e) => e.id === state.activeEventId) || null
    );
  }, [caseConfig, state.activeEventId]);

  useEffect(() => {
    if (!activeEvent) return;
    pushToast(
      `${activeEvent.severity === "critical" ? "危急" : "波动"}：${activeEvent.title}`,
      activeEvent.severity === "critical" ? "crit" : "warn",
      4500
    );
    // 仅在事件 id 变化时弹出，避免重复刷屏
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEvent?.id]);

  const currentVitals = useMemo(() => {
    if (!caseConfig) return null;
    return resolveCurrentVitals(caseConfig, state);
  }, [caseConfig, state]);

  const medOptions = useMemo(
    () => (caseConfig ? medicationOptionsFromCase(caseConfig) : []),
    [caseConfig]
  );

  const strategyOptions = useMemo(
    () => (caseConfig ? strategyOptionsFromCase(caseConfig) : []),
    [caseConfig]
  );

  const interviewPresets = useMemo(() => {
    if (!caseConfig) return [];
    return caseConfig.qaNodes.slice(0, 12).map((q) => ({
      id: q.id,
      label: q.category,
      text: q.intents[0] || q.category,
    }));
  }, [caseConfig]);

  const physItems = useMemo(
    () => (caseConfig ? physicalExamItems(caseConfig) : []),
    [caseConfig]
  );

  async function resolveEvent() {
    if (!sessionId || eventPicks.length === 0) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/sessions/${sessionId}/event`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optionIds: eventPicks }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "处置失败");
      setState(json.data.state);
      setScoreNotice(String(json.data.feedback || "已记录处置"));
      if (json.data.feedback) {
        pushToast(String(json.data.feedback), toastToneFromFeedback(String(json.data.feedback)));
      }
      setEventPicks([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "处置失败");
    } finally {
      setBusy(false);
    }
  }

  async function advanceObserve() {
    if (!sessionId) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/sessions/${sessionId}/observe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minutes: 8 }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "观察推进失败");
      setState(json.data.state);
      if (json.data.feedback) {
        const fb = String(json.data.feedback);
        setScoreNotice(fb);
        pushToast(fb, toastToneFromFeedback(fb));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "观察推进失败");
    } finally {
      setBusy(false);
    }
  }

  async function sendChat(presetText?: string) {
    const message = (presetText ?? input).trim();
    if (!sessionId || !message) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/sessions/${sessionId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "问诊失败");
      setState(json.data.state);
      if (json.data.feedback) {
        const fb = String(json.data.feedback);
        setScoreNotice(fb);
        pushToast(fb, toastToneFromFeedback(fb));
      }
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
      if (json.data.feedback) {
        const fb = String(json.data.feedback);
        setScoreNotice(fb);
        pushToast(fb, toastToneFromFeedback(fb));
      }
      if (json.data.timeoutWarning) {
        const tw = String(json.data.timeoutWarning);
        setTimeoutNotice(tw);
        pushToast(tw, "warn", 4500);
      }
      if (json.data.message) setScoreNotice(String(json.data.message));
    } catch (e) {
      setError(e instanceof Error ? e.message : "开立失败");
    } finally {
      setBusy(false);
    }
  }

  async function doPhysical(key?: string) {
    if (!sessionId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/exam`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "physical",
          ...(key ? { key } : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "查体失败");
      const revealed =
        (json.data.revealed as Record<string, string> | undefined) ||
        (json.data.physicalExam as Record<string, string>);
      setPhysical(revealed);
      setState(json.data.state);
      if (json.data.feedback) {
        const fb = String(json.data.feedback);
        setScoreNotice(fb);
        pushToast(fb, toastToneFromFeedback(fb));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "查体失败");
    } finally {
      setBusy(false);
    }
  }

  async function submitDecision() {
    if (!sessionId) return;
    const labels = medOptions
      .filter((m) => selectedMeds.includes(m.id))
      .map((m) => m.label);
    const strat = strategyOptions.find((s) => s.id === selectedStrategy);
    let composedReason = reason;
    if (activeNode === "P5" && labels.length > 0) {
      composedReason = `已选用：${labels.join("、")}${
        reason.trim() ? `\n补充：${reason.trim()}` : ""
      }`;
    } else if (activeNode === "P6" && strat) {
      composedReason = `再灌注策略：${strat.label}${
        strat.desc ? `（${strat.desc}）` : ""
      }${reason.trim() ? `\n补充：${reason.trim()}` : ""}`;
    }
    if (!composedReason.trim()) {
      setError(
        activeNode === "P5"
          ? "请勾选药物或填写决策理由"
          : activeNode === "P6"
            ? "请选择策略或填写决策理由"
            : "请填写决策理由"
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/sessions/${sessionId}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodeId: activeNode,
          reason: composedReason,
          medicationIds: activeNode === "P5" ? selectedMeds : undefined,
          strategyId: activeNode === "P6" ? selectedStrategy || undefined : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "决策失败");
      setState(json.data.state);
      const fb = String(json.data.feedback || "已记录。");
      setScoreNotice(fb);
      pushToast(fb, toastToneFromFeedback(fb));
      if (json.data.timeoutWarning) {
        const tw = String(json.data.timeoutWarning);
        setTimeoutNotice(tw);
        pushToast(tw, "warn", 4500);
      }
      setReason("");
      if (activeNode === "P5") setSelectedMeds([]);
      if (activeNode === "P6") setSelectedStrategy("");
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
      <ToastStack toasts={toasts} onDismiss={dismiss} />
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
                  已处理 {state.eventLog.length}/{caseConfig.clinicalEvents.length} 波。
                  时钟随操作推进；也可点下方「继续观察」。约 T+
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
                className="w-full text-xs"
                disabled={busy}
                onClick={() => void advanceObserve()}
              >
                继续观察（推进 8 分钟）→ 触发病情变化
              </Button>
            ) : null}
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
                setTimeoutNotice("");
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

        {caseConfig.knowledgeCards?.length ? (
          <Card title="知识点" eyebrow="Cards">
            <div className="max-h-64 space-y-3 overflow-auto text-xs leading-relaxed">
              {caseConfig.knowledgeCards.map((card) => (
                <div key={card.title}>
                  <div className="mb-1 font-medium text-[var(--brand)]">{card.title}</div>
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
        {shownTimeout ? (
          <p className="rounded-lg border border-[var(--warn)] bg-[var(--amber-soft)] px-3 py-2 text-sm text-[var(--warn)]">
            {shownTimeout}
          </p>
        ) : null}
      </aside>

      <div className="space-y-4">
      {currentVitals ? <VitalsPanel resolved={currentVitals} /> : null}

      {activeEvent ? (
        <Card
          title={activeEvent.title}
          eyebrow={activeEvent.severity === "critical" ? "危急变化" : "病情波动"}
          className="border-[var(--crit)] bg-[var(--crit-soft)]/40"
        >
          <p className="mb-2 text-sm leading-relaxed">{activeEvent.description}</p>
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
                  ? "请先处置上方病情变化…"
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
          {activeNode === "P5" && medOptions.length > 0 ? (
            <div className="mb-3 space-y-2">
              <div className="font-mono text-[10px] tracking-[0.14em] text-[var(--muted)]">
                用药勾选
              </div>
              <div className="grid gap-1.5">
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

            {caseConfig.complicationTeaching ? (
              <div
                className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
                  report.branchPath === "B"
                    ? "border-[var(--crit)] bg-[var(--crit-soft)]"
                    : "border-[var(--line)] bg-[var(--panel)]"
                }`}
              >
                <div className="mb-1 font-medium">
                  {caseConfig.complicationTeaching.title}
                  {report.branchPath === "B" ? (
                    <span className="ml-2 font-mono text-[10px] text-[var(--crit)]">
                      与本次延误结局相关
                    </span>
                  ) : null}
                </div>
                <p className="text-[var(--muted)]">
                  <span className="text-[var(--ink)]">识别：</span>
                  {caseConfig.complicationTeaching.signs}
                </p>
                <p className="mt-1 text-[var(--muted)]">
                  <span className="text-[var(--ink)]">处置：</span>
                  {caseConfig.complicationTeaching.actions}
                </p>
                {caseConfig.complicationTeaching.wrongMoves ? (
                  <p className="mt-1 text-[var(--warn)]">
                    避免：{caseConfig.complicationTeaching.wrongMoves}
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="mb-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-4">
                <div className="mb-2 text-center text-sm font-medium">六维能力雷达图</div>
                <div className="flex justify-center">
                  <ScoreRadar scores={report.scores} max={report.max} />
                </div>
              </div>
              <div className="rounded-xl border border-[var(--line)] bg-white px-3 py-4">
                <PathComparison rows={report.pathComparison || []} />
              </div>
            </div>

            {report.nodeReviews?.length ? (
              <div className="mb-4 rounded-xl border border-[var(--line)] bg-white px-3 py-4">
                <div className="mb-3 text-sm font-medium">逐节点复盘评语</div>
                <NodeReviews rows={report.nodeReviews} />
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(Object.keys(SCORE_MAX) as Array<keyof ScoreDimensions>).map((k) => {
                const max = report.max?.[k] ?? SCORE_MAX[k];
                const val = report.scores?.[k] ?? 0;
                const pct = Math.min(100, (val / max) * 100);
                const comment = report.comments?.[k];
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
                    {comment ? (
                      <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">
                        {comment}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>

            {report.timeline?.length ? (
              <div className="mt-4">
                <div className="mb-2 text-sm font-medium">决策时间轴</div>
                <ul className="space-y-1.5 text-sm">
                  {report.timeline.map((t) => (
                    <li
                      key={`${t.nodeId}-${t.atMinute}`}
                      className="flex flex-wrap items-baseline gap-2 font-mono text-xs"
                    >
                      <span className="text-[var(--brand)]">T+{t.atMinute}</span>
                      <span>{t.nodeId}</span>
                      <span className="font-sans text-[var(--ink)]">{t.label}</span>
                      <span
                        className={
                          t.ok ? "text-[var(--ok)]" : "text-[var(--warn)]"
                        }
                      >
                        {t.ok ? "✓" : "⚠"} {t.note}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

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
              <div className="space-y-4">
                <div>
                  <div className="mb-2 text-sm font-medium">改进建议</div>
                  <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed">
                    {(report.suggestions || []).map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ol>
                </div>
                {report.recommendedModules?.length ? (
                  <div>
                    <div className="mb-2 text-sm font-medium">推荐强化训练模块</div>
                    <ul className="flex flex-wrap gap-2">
                      {report.recommendedModules.map((m) => (
                        <li
                          key={m}
                          className="rounded-lg bg-[var(--brand-soft)] px-2.5 py-1 text-xs text-[var(--brand)]"
                        >
                          {m}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </div>
          </Card>
        ) : null}
      </div>
      </div>
    </div>
  );
}
