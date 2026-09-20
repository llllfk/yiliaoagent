"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("teacher");
  const [password, setPassword] = useState("Teacher123!");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-6">
      <div>
        <p className="text-sm font-medium text-[var(--brand)]">ER-Think</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          急诊临床思维训练
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          学生训练台 / 教师教学看板 · 云端网页
        </p>
      </div>

      <Card>
        <form className="flex flex-col gap-3" onSubmit={onSubmit}>
          <label className="text-sm">
            账号
            <Input
              className="mt-1"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />
          </label>
          <label className="text-sm">
            密码
            <Input
              className="mt-1"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>
          {error ? (
            <p className="text-sm text-[var(--danger)]">{error}</p>
          ) : null}
          <Button type="submit" disabled={loading}>
            {loading ? "登录中…" : "登录"}
          </Button>
        </form>
        <p className="mt-4 text-xs leading-relaxed text-[var(--muted)]">
          初始化种子账号：教师 teacher / Teacher123! ；学生 student1 /
          Student123!
        </p>
      </Card>
    </main>
  );
}
