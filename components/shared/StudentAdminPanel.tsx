"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

type StudentRow = {
  id: number;
  username: string;
  displayName: string;
  createdAt: string;
};

type FormState = { displayName: string; username: string; password: string };

const emptyForm: FormState = { displayName: "", username: "", password: "" };

export function StudentAdminPanel() {
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/teacher/students");
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "加载失败");
      return;
    }
    setRows(json.data.students || []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setModal("create");
    setEditingId(null);
    setForm(emptyForm);
    setError("");
  }

  function openEdit(row: StudentRow) {
    setModal("edit");
    setEditingId(row.id);
    setForm({ displayName: row.displayName, username: row.username, password: "" });
    setError("");
  }

  function closeModal() {
    if (busy) return;
    setModal(null);
    setEditingId(null);
    setForm(emptyForm);
    setError("");
  }

  async function save() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(
        modal === "edit" && editingId
          ? `/api/teacher/students/${editingId}`
          : "/api/teacher/students",
        {
          method: modal === "edit" ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        }
      );
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "保存失败");
        return;
      }
      setMessage(modal === "edit" ? "账号已更新" : "学生账号已创建");
      setModal(null);
      setEditingId(null);
      setForm(emptyForm);
      await load();
    } catch {
      setError("网络错误");
    } finally {
      setBusy(false);
    }
  }

  async function remove(row: StudentRow) {
    const confirmed = window.confirm(
      `删除学生「${row.displayName}」（${row.username}）？其训练记录也会一并删除。`
    );
    if (!confirmed) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/teacher/students/${row.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "删除失败");
        return;
      }
      setMessage("已删除");
      await load();
    } catch {
      setError("网络错误");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 p-4 animate-fade-up">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl tracking-wide">学生管理</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            维护本班学生的姓名、登录账号和密码
          </p>
        </div>
        <Button type="button" onClick={openCreate}>
          新增学生
        </Button>
      </div>

      {message ? (
        <p className="rounded-lg bg-[var(--ok-soft)] px-3 py-2 text-sm text-[var(--ok)]">
          {message}
        </p>
      ) : null}

      <Card title="学生列表" eyebrow="Students">
        <div className="overflow-x-auto rounded-xl border border-[var(--line)]">
          <table className="data-table">
            <thead>
              <tr>
                <th>姓名</th>
                <th>账号</th>
                <th>创建时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="font-medium">{row.displayName}</td>
                  <td className="font-mono text-sm">{row.username}</td>
                  <td className="text-xs text-[var(--muted)]">
                    {new Date(row.createdAt).toLocaleString()}
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(row)}
                      >
                        修改
                      </Button>
                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        disabled={busy}
                        onClick={() => void remove(row)}
                      >
                        删除
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-[var(--muted)]">
                    还没有学生账号，点右上角「新增学生」
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>

      {modal && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4"
              onClick={closeModal}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="student-modal-title"
                className="w-full max-w-md rounded-[var(--radius)] border border-[var(--line)] bg-white px-5 py-4 shadow-[var(--shadow)]"
                onClick={(e) => e.stopPropagation()}
              >
                <h2 id="student-modal-title" className="font-display text-xl leading-tight">
                  {modal === "edit" ? "修改学生账号" : "新增学生账号"}
                </h2>
                <div className="mt-4 flex flex-col gap-3">
                  <label className="text-sm">
                    姓名
                    <Input
                      className="mt-1"
                      value={form.displayName}
                      onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                      placeholder="例如：李明"
                    />
                  </label>
                  <label className="text-sm">
                    账号
                    <Input
                      className="mt-1"
                      value={form.username}
                      onChange={(e) => setForm({ ...form, username: e.target.value })}
                      placeholder="例如：student2"
                      autoComplete="off"
                    />
                  </label>
                  <label className="text-sm">
                    密码
                    <Input
                      className="mt-1"
                      type="password"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      placeholder={modal === "edit" ? "留空表示不修改" : "至少 6 位"}
                      autoComplete="new-password"
                    />
                  </label>
                  {error ? (
                    <p className="rounded-lg bg-[var(--crit-soft)] px-3 py-2 text-sm text-[var(--crit)]">
                      {error}
                    </p>
                  ) : null}
                  <div className="flex justify-end gap-2 pt-1">
                    <Button type="button" variant="ghost" disabled={busy} onClick={closeModal}>
                      取消
                    </Button>
                    <Button type="button" disabled={busy} onClick={() => void save()}>
                      {busy ? "保存中…" : "保存"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
