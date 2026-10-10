"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ToastStack, useToasts } from "@/components/ui/Toast";
import { ecgTimeoutWarning } from "@/lib/er-think/scoring";
import {
  medicationOptionsFromCase,
  resolveCurrentVitals,
  strategyOptionsFromCase,
} from "@/lib/er-think/vitals";
import { physicalExamItems } from "@/lib/er-think/node-debrief";
import type { CaseConfig, ClinicalEvent, SessionState } from "@/types";
import { SCORE_MAX, createInitialSessionState } from "@/types";
import {
  DECISIONS,
  toastToneFromFeedback,
  type DecisionId,
  type DebriefReport,
} from "@/components/train/train-shared";

type TrainSessionContextValue = {
  sessionId: number;
  caseConfig: CaseConfig;
  state: SessionState;
  busy: boolean;
  error: string;
  setError: (v: string) => void;
  scoreNotice: string;
  shownTimeout: string;
  report: DebriefReport | null;
  physical: Record<string, string> | null;
  input: string;
  setInput: (v: string) => void;
  reason: string;
  setReason: (v: string) => void;
  activeNode: DecisionId;
  setActiveNode: (v: DecisionId) => void;
  eventPicks: string[];
  setEventPicks: (v: string[] | ((prev: string[]) => string[])) => void;
  selectedMeds: string[];
  setSelectedMeds: (v: string[] | ((prev: string[]) => string[])) => void;
  selectedStrategy: string;
  setSelectedStrategy: (v: string) => void;
  wallStartedAt: number | null;
  wallNow: number;
  totalScore: number;
  examResults: Array<{
    examId: string;
    orderedAtMinute: number;
    readyAtMinute: number;
    label: string;
    critical?: boolean;
    text: string;
    ready: boolean;
  }>;
  activeEvent: ClinicalEvent | null;
  currentVitals: ReturnType<typeof resolveCurrentVitals> | null;
  medOptions: ReturnType<typeof medicationOptionsFromCase>;
  strategyOptions: ReturnType<typeof strategyOptionsFromCase>;
  interviewPresets: Array<{ id: string; label: string; text: string }>;
  physItems: ReturnType<typeof physicalExamItems>;
  loading: boolean;
  loadError: string;
  resolveEvent: () => Promise<void>;
  advanceObserve: () => Promise<void>;
  sendChat: (presetText?: string) => Promise<void>;
  orderExam: (examId: string) => Promise<void>;
  doPhysical: (key?: string) => Promise<void>;
  submitDecision: () => Promise<void>;
  finish: () => Promise<boolean>;
};

const TrainSessionContext = createContext<TrainSessionContextValue | null>(
  null
);

export function useTrainSession() {
  const ctx = useContext(TrainSessionContext);
  if (!ctx) {
    throw new Error("useTrainSession must be used within TrainSessionProvider");
  }
  return ctx;
}

export function TrainSessionProvider({
  sessionId,
  children,
}: {
  sessionId: number;
  children: ReactNode;
}) {
  const [caseConfig, setCaseConfig] = useState<CaseConfig | null>(null);
  const [state, setState] = useState<SessionState>(createInitialSessionState());
  const [input, setInput] = useState("");
  const [reason, setReason] = useState("");
  const [activeNode, setActiveNode] = useState<DecisionId>("P1");
  const [report, setReport] = useState<DebriefReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [scoreNotice, setScoreNotice] = useState("");
  const [timeoutNotice, setTimeoutNotice] = useState("");
  const [physical, setPhysical] = useState<Record<string, string> | null>(null);
  const [eventPicks, setEventPicks] = useState<string[]>([]);
  const [selectedMeds, setSelectedMeds] = useState<string[]>([]);
  const [selectedStrategy, setSelectedStrategy] = useState("");
  const [wallStartedAt, setWallStartedAt] = useState<number | null>(null);
  const [wallNow, setWallNow] = useState(() => Date.now());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const { toasts, pushToast, dismiss } = useToasts();

  useEffect(() => {
    if (state.finished || !wallStartedAt) return;
    const t = window.setInterval(() => setWallNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [state.finished, wallStartedAt]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setLoadError("");
      try {
        const resumeRes = await fetch(`/api/sessions/${sessionId}`);
        const resumeJson = await resumeRes.json();
        if (!resumeRes.ok) {
          throw new Error(resumeJson.error || "读取训练失败");
        }
        const session = resumeJson.data.session as {
          id: number;
          status: string;
          case_code: string;
          state: SessionState;
          score_detail?: DebriefReport | string | null;
        };
        const caseRes = await fetch(
          `/api/cases/${encodeURIComponent(session.case_code)}`
        );
        const caseJson = await caseRes.json();
        if (!caseRes.ok) throw new Error(caseJson.error || "加载病例失败");
        const cfg = (caseJson.data.case.config ||
          caseJson.data.case) as CaseConfig;
        const raw = session.state as SessionState | string;
        const nextState =
          typeof raw === "string" ? (JSON.parse(raw) as SessionState) : raw;
        const statusDone =
          session.status === "completed" || session.status === "finished";
        const initial = createInitialSessionState();
        const merged: SessionState = {
          ...initial,
          ...nextState,
          scores: {
            ...initial.scores,
            ...(nextState.scores || {}),
          },
          eventLog: nextState.eventLog || [],
          physicalKeys: nextState.physicalKeys || [],
          activeEventId: nextState.activeEventId ?? null,
          finished: statusDone || Boolean(nextState.finished),
        };
        let restoredReport: DebriefReport | null = null;
        if (session.score_detail) {
          const detail = session.score_detail;
          const parsed =
            typeof detail === "string"
              ? (JSON.parse(detail) as DebriefReport)
              : detail;
          if (parsed && typeof parsed === "object") {
            restoredReport = {
              ...parsed,
              scores: {
                ...merged.scores,
                ...(parsed.scores || {}),
              },
              max: parsed.max || SCORE_MAX,
            };
          }
        }
        if (cancelled) return;
        setCaseConfig(cfg);
        setState(merged);
        const physAll = cfg.physicalExam || {};
        const keys = merged.physicalKeys || [];
        setPhysical(
          keys.length
            ? Object.fromEntries(
                keys.map((k) => [k, physAll[k]]).filter(([, v]) => v)
              )
            : null
        );
        setWallStartedAt(Date.now());
        setWallNow(Date.now());
        setActiveNode("P1");
        setEventPicks([]);
        setSelectedMeds([]);
        setSelectedStrategy("");
        setInput("");
        setReason("");
        setReport(restoredReport);
        setScoreNotice("");
        setTimeoutNotice("");
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : "加载训练失败");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

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
      (state.scores?.TRI || 0) +
      (state.scores?.INF || 0) +
      (state.scores?.DIA || 0) +
      (state.scores?.MAN || 0) +
      (state.scores?.DYN || 0) +
      (state.scores?.EBM || 0),
    [state.scores]
  );

  const liveTimeout = useMemo(() => ecgTimeoutWarning(state), [state]);
  const shownTimeout = timeoutNotice || liveTimeout || "";

  const activeEvent: ClinicalEvent | null = useMemo(() => {
    if (!caseConfig?.clinicalEvents || !state.activeEventId) return null;
    return (
      caseConfig.clinicalEvents.find((e) => e.id === state.activeEventId) ||
      null
    );
  }, [caseConfig, state.activeEventId]);

  useEffect(() => {
    if (!activeEvent) return;
    pushToast(
      `${activeEvent.severity === "critical" ? "危急" : "波动"}：${activeEvent.title}`,
      activeEvent.severity === "critical" ? "crit" : "warn",
      4500
    );
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

  const resolveEvent = useCallback(async () => {
    if (eventPicks.length === 0) return;
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
        pushToast(
          String(json.data.feedback),
          toastToneFromFeedback(String(json.data.feedback))
        );
      }
      setEventPicks([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "处置失败");
    } finally {
      setBusy(false);
    }
  }, [eventPicks, pushToast, sessionId]);

  const advanceObserve = useCallback(async () => {
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
  }, [pushToast, sessionId]);

  const sendChat = useCallback(
    async (presetText?: string) => {
      const message = (presetText ?? input).trim();
      if (!message) return;
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
    },
    [input, pushToast, sessionId]
  );

  const orderExam = useCallback(
    async (examId: string) => {
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
    },
    [pushToast, sessionId]
  );

  const doPhysical = useCallback(
    async (key?: string) => {
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
    },
    [pushToast, sessionId]
  );

  const submitDecision = useCallback(async () => {
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
          strategyId:
            activeNode === "P6" ? selectedStrategy || undefined : undefined,
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
  }, [
    activeNode,
    medOptions,
    pushToast,
    reason,
    selectedMeds,
    selectedStrategy,
    sessionId,
    strategyOptions,
  ]);

  const finish = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/finish`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "结束失败");
      setState(json.data.state);
      setReport(json.data.report as DebriefReport);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "结束失败");
      return false;
    } finally {
      setBusy(false);
    }
  }, [sessionId]);

  if (loading) {
    return (
      <div className="p-6 text-sm text-[var(--muted)]">正在载入训练会话…</div>
    );
  }

  if (loadError || !caseConfig) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <p className="text-sm text-[var(--crit)]">
          {loadError || "无法加载病例配置"}
        </p>
        <a
          href="/train"
          className="mt-3 inline-block text-sm text-[var(--brand)] underline"
        >
          返回选病例
        </a>
      </div>
    );
  }

  const value: TrainSessionContextValue = {
    sessionId,
    caseConfig,
    state,
    busy,
    error,
    setError,
    scoreNotice,
    shownTimeout,
    report,
    physical,
    input,
    setInput,
    reason,
    setReason,
    activeNode,
    setActiveNode,
    eventPicks,
    setEventPicks,
    selectedMeds,
    setSelectedMeds,
    selectedStrategy,
    setSelectedStrategy,
    wallStartedAt,
    wallNow,
    totalScore,
    examResults,
    activeEvent,
    currentVitals,
    medOptions,
    strategyOptions,
    interviewPresets,
    physItems,
    loading,
    loadError,
    resolveEvent,
    advanceObserve,
    sendChat,
    orderExam,
    doPhysical,
    submitDecision,
    finish,
  };

  return (
    <TrainSessionContext.Provider value={value}>
      <ToastStack toasts={toasts} onDismiss={dismiss} />
      {children}
    </TrainSessionContext.Provider>
  );
}

export { DECISIONS };
