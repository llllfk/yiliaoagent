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
import { resolveCurrentVitals } from "@/lib/er-think/vitals";
import { physicalExamItems } from "@/lib/er-think/node-debrief";
import type { CaseConfig, ClinicalEvent, SessionState } from "@/types";
import { SCORE_MAX, createInitialSessionState } from "@/types";
import {
  toastToneFromFeedback,
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
  eventPicks: string[];
  setEventPicks: (v: string[] | ((prev: string[]) => string[])) => void;
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
  interviewPresets: Array<{ id: string; label: string; text: string }>;
  physItems: ReturnType<typeof physicalExamItems>;
  loading: boolean;
  loadError: string;
  resolveEvent: () => Promise<void>;
  advanceObserve: () => Promise<void>;
  sendChat: (presetText?: string) => Promise<void>;
  orderExam: (examId: string) => Promise<void>;
  doPhysical: (key?: string) => Promise<void>;
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
  const [report, setReport] = useState<DebriefReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [scoreNotice, setScoreNotice] = useState("");
  const [timeoutNotice, setTimeoutNotice] = useState("");
  const [physical, setPhysical] = useState<Record<string, string> | null>(null);
  const [eventPicks, setEventPicks] = useState<string[]>([]);
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
        setEventPicks([]);
        setInput("");
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
    eventPicks,
    setEventPicks,
    wallStartedAt,
    wallNow,
    totalScore,
    examResults,
    activeEvent,
    currentVitals,
    interviewPresets,
    physItems,
    loading,
    loadError,
    resolveEvent,
    advanceObserve,
    sendChat,
    orderExam,
    doPhysical,
    finish,
  };

  return (
    <TrainSessionContext.Provider value={value}>
      <ToastStack toasts={toasts} onDismiss={dismiss} />
      {children}
    </TrainSessionContext.Provider>
  );
}
