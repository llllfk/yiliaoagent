"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { CaseOption, OpenSession } from "@/components/train/train-shared";

export function TrainCasePicker() {
  const router = useRouter();
  const [caseList, setCaseList] = useState<CaseOption[]>([]);
  const [selectedCode, setSelectedCode] = useState("");
  const [openSessions, setOpenSessions] = useState<OpenSession[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

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
    try {
      let nextId: number;
      if (resumeId) {
        const resumeRes = await fetch(`/api/sessions/${resumeId}`);
        const resumeJson = await resumeRes.json();
        if (!resumeRes.ok) {
          throw new Error(resumeJson.error || "读取未完成训练失败");
        }
        const session = resumeJson.data.session as {
          id: number;
          status: string;
        };
        if (session.status !== "in_progress") {
          throw new Error("这条记录已经结束，请重新开始");
        }
        nextId = Number(session.id);
      } else {
        const startRes = await fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ caseCode }),
        });
        const startJson = await startRes.json();
        if (!startRes.ok) throw new Error(startJson.error || "创建会话失败");
        nextId = Number(startJson.data.sessionId);
        await loadOpenSessions();
      }
      router.push(`/train/${nextId}/overview`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "开始训练失败");
      setBusy(false);
    }
  }

  const pending = openSessions.find(
    (s) => s.case_code === selectedCode && s.status === "in_progress"
  );

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
                  onClick={() =>
                    void startSession(selectedCode, Number(pending.id))
                  }
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
          </div>
        )}
        {error ? (
          <p className="mt-3 text-sm text-[var(--crit)]">{error}</p>
        ) : null}
      </Card>
    </div>
  );
}
