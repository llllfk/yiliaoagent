"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useTrainSession } from "@/components/train/TrainSessionContext";
import { formatWallClock } from "@/components/train/train-shared";
import { SCORE_MAX } from "@/types";

const NAV = [
  { slug: "overview", label: "患者基本信息" },
  { slug: "interview", label: "问诊" },
  { slug: "exam", label: "检查" },
  { slug: "decisions", label: "决策" },
  { slug: "debrief", label: "复盘" },
] as const;

export function TrainSideNav() {
  const pathname = usePathname();
  const router = useRouter();
  const {
    sessionId,
    caseConfig,
    state,
    busy,
    error,
    shownTimeout,
    scoreNotice,
    totalScore,
    wallStartedAt,
    wallNow,
    activeEvent,
    finish,
  } = useTrainSession();

  const base = `/train/${sessionId}`;

  async function onFinish() {
    const ok = await finish();
    if (ok) router.push(`${base}/debrief`);
  }

  return (
    <aside className="space-y-4 animate-fade-up">
      <div className="rounded-xl border border-[var(--line)] bg-white p-3">
        <div className="font-display text-base leading-snug">
          {caseConfig.title}
        </div>
        <div className="mt-1 font-mono text-[11px] text-[var(--muted)]">
          {caseConfig.code} · T+{state.simMinutes} min
        </div>
        <div className="mt-2 rounded-lg border border-teal-200 bg-[var(--night)] px-2 py-2 text-center">
          <div className="font-mono text-[10px] tracking-[0.16em] text-teal-300/80">
            SIM / WALL
          </div>
          <div className="monitor-clock text-xl font-semibold">
            T+{state.simMinutes}
            <span className="ml-2 wall-clock font-mono text-sm text-teal-100">
              {wallStartedAt
                ? formatWallClock(wallNow - wallStartedAt)
                : "00:00"}
            </span>
          </div>
        </div>
      </div>

      <nav className="flex gap-1.5 overflow-x-auto lg:flex-col lg:overflow-visible">
        {NAV.map((item) => {
          const href = `${base}/${item.slug}`;
          const active = pathname === href || pathname.endsWith(`/${item.slug}`);
          const locked = item.slug === "debrief" && !state.finished;
          const badge =
            item.slug === "overview" && activeEvent
              ? "!"
              : item.slug === "debrief" && state.finished
                ? "✓"
                : null;
          const className = `relative shrink-0 rounded-lg px-3 py-2 text-sm transition lg:w-full ${
            locked
              ? "cursor-not-allowed bg-[var(--panel)] text-[var(--muted)] opacity-60"
              : active
                ? "bg-[var(--brand)] font-medium text-white"
                : "bg-[var(--panel)] text-[var(--ink)] hover:bg-[var(--brand-soft)]"
          }`;
          const badgeEl = badge ? (
            <span
              className={`ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] ${
                item.slug === "overview" && activeEvent
                  ? "bg-[var(--crit)] text-white"
                  : active
                    ? "bg-white/25 text-white"
                    : "bg-[var(--brand)] text-white"
              }`}
            >
              {badge}
            </span>
          ) : null;
          if (locked) {
            return (
              <span
                key={item.slug}
                className={`${className} flex flex-col items-start gap-0.5 lg:flex-row lg:items-center lg:justify-between`}
                title="结束后可查看复盘与知识点"
              >
                <span>{item.label}</span>
                <span className="text-[10px] font-normal text-[var(--muted)]">
                  结束后可看
                </span>
              </span>
            );
          }
          return (
            <Link key={item.slug} href={href} className={className}>
              {item.label}
              {badgeEl}
            </Link>
          );
        })}
      </nav>

      <div className="rounded-xl border border-[var(--line)] bg-white p-3">
        <div className="mb-2 flex items-end justify-between">
          <span className="text-xs text-[var(--muted)]">六维累计</span>
          <span className="font-mono text-lg font-semibold text-[var(--brand)]">
            {totalScore}
            <span className="text-xs text-[var(--muted)]">/100</span>
          </span>
        </div>
        <ul className="space-y-1.5">
          {(Object.keys(SCORE_MAX) as Array<keyof typeof SCORE_MAX>).map(
            (k) => {
              const max = SCORE_MAX[k];
              const val = state.scores?.[k] ?? 0;
              const pct = Math.min(100, (val / max) * 100);
              return (
                <li key={k}>
                  <div className="mb-0.5 flex justify-between font-mono text-[10px]">
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
          <p className="mt-2 rounded-lg bg-[var(--brand-soft)] px-2 py-1.5 text-[11px] leading-relaxed">
            {scoreNotice}
          </p>
        ) : null}
      </div>

      <Button
        type="button"
        variant="danger"
        className="w-full"
        disabled={busy || state.finished}
        onClick={() => void onFinish()}
      >
        结束演练并复盘
      </Button>
      <Button
        type="button"
        variant="ghost"
        className="w-full text-xs"
        disabled={busy}
        onClick={() => router.push("/train")}
      >
        返回选病例
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
  );
}
