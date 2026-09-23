"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

type CaseRow = {
  id: number;
  code: string;
  title: string;
  difficulty: string | null;
  targetMinutes: string | null;
  isPublished: boolean;
  updatedAt: string;
};

const TEMPLATE_HINT = `{
  "code": "my-case-01",
  "title": "病例标题",
  "difficulty": "进阶级",
  "targetMinutes": "20–25",
  "patient": { "name": "患者名", "age": 50, "chief": "主诉摘要" },
  "qaNodes": [
    {
      "id": "Q1",
      "category": "主诉",
      "intents": ["你怎么了", "哪里不舒服"],
      "answer": "患者口语回答"
    }
  ],
  "exams": [
    {
      "id": "ecg",
      "label": "心电图",
      "costMinutes": 5,
      "costFee": 80,
      "critical": true,
      "result": "检查结果文本"
    }
  ],
  "physicalExam": {
    "vitals": "生命体征",
    "general": "一般情况"
  },
  "decisionNodes": [
    { "id": "P1", "name": "分诊分级", "hint": "提示" },
    { "id": "P2", "name": "心电图时间窗", "hint": "提示" },
    { "id": "P3", "name": "病史完整性", "hint": "提示" },
    { "id": "P4", "name": "鉴别诊断", "hint": "提示" },
    { "id": "P5", "name": "初始药物治疗", "hint": "提示" },
    { "id": "P6", "name": "再灌注决策", "hint": "提示" },
    { "id": "P7", "name": "动态监测", "hint": "提示" },
    { "id": "P8", "name": "循证表达", "hint": "提示" }
  ]
}`;

export function CaseImportPanel() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [jsonText, setJsonText] = useState("");
  const [fileName, setFileName] = useState("");
  const [publish, setPublish] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);

  const loadCases = useCallback(async () => {
    const res = await fetch("/api/teacher/cases");
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "加载病例失败");
      return;
    }
    setCases(json.data.cases || []);
  }, []);

  useEffect(() => {
    void loadCases();
  }, [loadCases]);

  async function onImport() {
    setBusy(true);
    setError("");
    setMessage("");
    setErrors([]);
    setWarnings([]);
    try {
      let parsed: unknown;
      try {
        parsed = JSON.parse(jsonText);
      } catch {
        setError("JSON 格式无法解析，请检查逗号与引号");
        return;
      }

      const res = await fetch("/api/teacher/cases/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: parsed, publish }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "导入失败");
        const detailErrors = json.detail?.errors;
        if (Array.isArray(detailErrors)) setErrors(detailErrors);
        return;
      }
      setMessage(json.data.message || "导入成功");
      setWarnings(json.data.warnings || []);
      await loadCases();
    } catch {
      setError("网络错误");
    } finally {
      setBusy(false);
    }
  }

  async function onFile(file: File | null) {
    if (!file) return;
    setFileName(file.name);
    const text = await file.text();
    setJsonText(text);
  }

  async function togglePublish(row: CaseRow) {
    setBusy(true);
    try {
      const res = await fetch(`/api/teacher/cases/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublished: !row.isPublished }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "更新失败");
        return;
      }
      await loadCases();
    } finally {
      setBusy(false);
    }
  }

  async function loadTemplate() {
    const res = await fetch("/api/cases/stemi-03");
    const json = await res.json();
    if (!res.ok) {
      setJsonText(TEMPLATE_HINT);
      return;
    }
    const cfg = json.data.case.config || json.data.case;
    // 导出时去掉库字段，给老师可改的干净模板
    const clean = {
      code: `${cfg.code || "stemi-03"}-copy`,
      title: cfg.title,
      difficulty: cfg.difficulty,
      targetMinutes: cfg.targetMinutes,
      patient: cfg.patient,
      qaNodes: cfg.qaNodes,
      exams: cfg.exams,
      physicalExam: cfg.physicalExam,
      decisionNodes: cfg.decisionNodes,
    };
    setJsonText(JSON.stringify(clean, null, 2));
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 p-4 animate-fade-up">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/dashboard"
            className="text-sm text-[var(--brand)] underline-offset-2 hover:underline"
          >
            ← 返回看板
          </Link>
          <h1 className="mt-2 font-display text-2xl tracking-wide">病例导入</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            上传或粘贴病例 JSON；同 code 再次导入将覆盖更新
          </p>
        </div>
        <Button type="button" variant="ghost" onClick={() => void loadTemplate()}>
          载入 STEMI 模板副本
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="导入病例包" eyebrow="Import">
          <div className="mb-3">
            <div className="mb-2 text-sm font-medium text-[var(--ink)]">
              选择 JSON 文件
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                void onFile(e.target.files?.[0] || null);
                e.target.value = "";
              }}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => fileInputRef.current?.click()}
              >
                选择文件
              </Button>
              {fileName ? (
                <>
                  <span className="max-w-[220px] truncate font-mono text-xs text-[var(--muted)]">
                    {fileName}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-xs"
                    onClick={() => {
                      setFileName("");
                      setJsonText("");
                    }}
                  >
                    清除
                  </Button>
                </>
              ) : (
                <span className="text-xs text-[var(--muted)]">未选择文件</span>
              )}
            </div>
          </div>
          <textarea
            className="min-h-[320px] w-full rounded-lg border border-[var(--line)] bg-[var(--night)] p-3 font-mono text-xs text-teal-100 outline-none focus:ring-2 focus:ring-[var(--brand-soft)]"
            placeholder="在此粘贴病例 JSON…"
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
          />
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={publish}
              onChange={(e) => setPublish(e.target.checked)}
            />
            导入后立即对学生发布
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={busy || !jsonText.trim()}
              onClick={() => void onImport()}
            >
              {busy ? "导入中…" : "校验并导入"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => fileInputRef.current?.click()}
            >
              重新选择文件
            </Button>
          </div>
          {message ? (
            <p className="mt-3 rounded-lg bg-[var(--ok-soft)] px-3 py-2 text-sm text-[var(--ok)]">
              {message}
            </p>
          ) : null}
          {error ? (
            <p className="mt-3 rounded-lg bg-[var(--crit-soft)] px-3 py-2 text-sm text-[var(--crit)]">
              {error}
            </p>
          ) : null}
          {errors.length > 0 ? (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-[var(--crit)]">
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          ) : null}
          {warnings.length > 0 ? (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-[var(--amber)]">
              {warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          ) : null}
        </Card>

        <Card title="本租户病例" eyebrow="Library">
          <div className="space-y-2">
            {cases.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">暂无病例，请先导入</p>
            ) : (
              cases.map((c) => (
                <div
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--line)] px-3 py-3"
                >
                  <div>
                    <div className="font-medium">{c.title}</div>
                    <div className="font-mono text-xs text-[var(--muted)]">
                      {c.code} · {c.difficulty || "-"} · {c.targetMinutes || "-"}{" "}
                      min
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`status-pill ${c.isPublished ? "done" : "running"}`}
                    >
                      {c.isPublished ? "已发布" : "未发布"}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-xs"
                      disabled={busy}
                      onClick={() => void togglePublish(c)}
                    >
                      {c.isPublished ? "下架" : "发布"}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
          <p className="mt-4 text-xs leading-relaxed text-[var(--muted)]">
            字段说明：code 唯一编码；qaNodes 为问诊话术；exams
            为检查项与耗时；decisionNodes 建议含 P1–P8。可先「载入 STEMI
            模板副本」改 code/内容后再导入。
          </p>
        </Card>
      </div>
    </div>
  );
}
