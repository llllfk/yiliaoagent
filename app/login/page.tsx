"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { EcgMark } from "@/components/shared/EcgMark";

const DEMO_ACCOUNTS = [
  {
    role: "教师",
    label: "教师账号",
    username: "teacher",
    password: "Teacher123!",
    hint: "进入教学看板",
  },
  {
    role: "学生",
    label: "学生账号",
    username: "student1",
    password: "Student123!",
    hint: "进入训练台",
  },
] as const;

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function fillAccount(account: (typeof DEMO_ACCOUNTS)[number]) {
    setUsername(account.username);
    setPassword(account.password);
    setError("");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "登录失败");
        return;
      }
      router.replace(json.data.redirectTo || "/");
      router.refresh();
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-[1.1fr_0.9fr]">
      <section className="relative hidden overflow-hidden bg-[var(--night)] px-10 py-12 text-slate-100 lg:flex lg:flex-col lg:justify-between">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "linear-gradient(rgba(45,212,191,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(45,212,191,0.08) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
        <div className="relative animate-fade-up">
          <div className="mb-6 flex items-center gap-3">
            <span className="live-dot" />
            <span className="font-mono text-xs tracking-[0.22em] text-teal-300/90">
              EMERGENCY REASONING
            </span>
          </div>
          <h1 className="font-display text-5xl leading-tight tracking-wide text-white">
            ER-Think
          </h1>
          <p className="mt-4 max-w-md text-base leading-relaxed text-slate-300">
            急诊临床思维训练台。在时间窗内完成问诊、检查与关键决策，按六维能力复盘。
          </p>
          <div className="mt-8">
            <EcgMark />
          </div>
        </div>
        <div className="relative grid max-w-lg grid-cols-3 gap-3 text-sm animate-fade-up">
          {[
            ["问诊", "渐进解锁"],
            ["时钟", "指南时间窗"],
            ["评测", "可追溯打分"],
          ].map(([k, v]) => (
            <div
              key={k}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 backdrop-blur"
            >
              <div className="font-mono text-[10px] tracking-widest text-teal-300/80">
                {k}
              </div>
              <div className="mt-1 text-slate-100">{v}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md animate-fade-up">
          <div className="mb-8 lg:hidden">
            <div className="font-display text-3xl text-[var(--ink)]">ER-Think</div>
            <p className="mt-1 text-sm text-[var(--muted)]">急诊临床思维训练</p>
          </div>

          <div className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel-strong)] p-6 shadow-[var(--shadow)] sm:p-8">
            <div className="mb-6">
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--brand)]">
                Sign in
              </div>
              <h2 className="mt-1 font-display text-2xl tracking-wide">进入训练系统</h2>
              <p className="mt-2 text-sm text-[var(--muted)]">
                学生进入训练台，教师进入教学看板
              </p>
            </div>

            <div className="mb-5 grid grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map((account) => {
                const active = username === account.username;
                return (
                  <button
                    key={account.username}
                    type="button"
                    onClick={() => fillAccount(account)}
                    className={`rounded-xl border px-3 py-3 text-left transition ${
                      active
                        ? "border-[var(--brand)] bg-[var(--brand-soft)]"
                        : "border-[var(--line)] bg-[var(--panel)] hover:border-[var(--brand)]"
                    }`}
                  >
                    <div className="text-sm font-medium text-[var(--ink)]">
                      {account.label}
                    </div>
                    <div className="mt-1 font-mono text-[11px] text-[var(--muted)]">
                      {account.username}
                    </div>
                    <div className="mt-0.5 text-[11px] text-[var(--muted)]">
                      {account.hint}
                    </div>
                  </button>
                );
              })}
            </div>

            <form className="flex flex-col gap-4" onSubmit={onSubmit}>
              <label className="text-sm font-medium">
                账号
                <Input
                  className="mt-1.5"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  placeholder="点击上方快捷填入，或手动输入"
                />
              </label>
              <label className="text-sm font-medium">
                密码
                <Input
                  className="mt-1.5"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="快捷填入后自动带出"
                />
              </label>
              {error ? (
                <p className="rounded-lg bg-[var(--crit-soft)] px-3 py-2 text-sm text-[var(--crit)]">
                  {error}
                </p>
              ) : null}
              <Button type="submit" className="mt-1 h-11" disabled={loading}>
                {loading ? "登录中…" : "登录"}
              </Button>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}
