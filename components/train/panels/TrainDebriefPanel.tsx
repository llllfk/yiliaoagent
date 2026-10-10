"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ScoreRadar } from "@/components/train/ScoreRadar";
import { PathComparison } from "@/components/train/PathComparison";
import { NodeReviews } from "@/components/train/NodeReviews";
import { useTrainSession } from "@/components/train/TrainSessionContext";
import {
  DIM_LABEL,
  PATH_LABEL,
} from "@/components/train/train-shared";
import { downloadDebrief } from "@/lib/debrief-doc";
import { SCORE_MAX, type ScoreDimensions } from "@/types";

export function TrainDebriefPanel() {
  const router = useRouter();
  const { sessionId, caseConfig, state, report, busy, finish } =
    useTrainSession();

  if (!state.finished && !report) {
    return (
      <div className="animate-fade-up">
        <Card title="复盘成绩单" eyebrow="Debrief">
          <p className="mb-4 text-sm leading-relaxed text-[var(--muted)]">
            训练尚未结束。完成问诊、检查与关键决策后，在左侧点击「结束演练并复盘」，成绩单将显示在本页。
          </p>
          <Button
            type="button"
            variant="danger"
            disabled={busy}
            onClick={() => {
              void (async () => {
                const ok = await finish();
                if (ok) router.replace(`/train/${sessionId}/debrief`);
              })();
            }}
          >
            结束演练并生成复盘
          </Button>
        </Card>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="animate-fade-up">
        <Card title="复盘成绩单" eyebrow="Debrief">
          <p className="mb-3 text-sm text-[var(--muted)]">
            本会话已结束，但当前页未缓存详细复盘。请到「我的记录」查看完整成绩单。
          </p>
          <Link
            href={`/history/detail?id=${sessionId}`}
            className="text-sm text-[var(--brand)] underline"
          >
            打开训练记录详情
          </Link>
        </Card>
      </div>
    );
  }

  const scores: ScoreDimensions = {
    TRI: Number(report.scores?.TRI ?? state.scores?.TRI ?? 0),
    INF: Number(report.scores?.INF ?? state.scores?.INF ?? 0),
    DIA: Number(report.scores?.DIA ?? state.scores?.DIA ?? 0),
    MAN: Number(report.scores?.MAN ?? state.scores?.MAN ?? 0),
    DYN: Number(report.scores?.DYN ?? state.scores?.DYN ?? 0),
    EBM: Number(report.scores?.EBM ?? state.scores?.EBM ?? 0),
  };
  const maxScores = report.max || SCORE_MAX;
  const total =
    report.total ??
    scores.TRI + scores.INF + scores.DIA + scores.MAN + scores.DYN + scores.EBM;
  const branchPath = report.branchPath || state.branchPath;

  return (
    <div className="animate-fade-up">
      <Card title="复盘成绩单" eyebrow="Debrief">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="font-mono text-[10px] tracking-[0.16em] text-[var(--muted)]">
              TOTAL
            </div>
            <div className="font-display text-4xl leading-none text-[var(--brand)]">
              {total}
              <span className="ml-1 text-lg text-[var(--muted)]">/ 100</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="rounded-xl bg-[var(--amber-soft)] px-4 py-3 text-sm">
              <div className="text-xs text-[var(--muted)]">结局</div>
              <div className="font-medium">
                Path {branchPath || "?"} ·{" "}
                {report.outcome?.title ||
                  (branchPath ? PATH_LABEL[branchPath] : null) ||
                  "未判定"}
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              onClick={() =>
                downloadDebrief(
                  { ...report, scores, max: maxScores, total, branchPath },
                  caseConfig.title
                )
              }
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
              branchPath === "B"
                ? "border-[var(--crit)] bg-[var(--crit-soft)]"
                : "border-[var(--line)] bg-[var(--panel)]"
            }`}
          >
            <div className="mb-1 font-medium">
              {caseConfig.complicationTeaching.title}
              {branchPath === "B" ? (
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
            <div className="mb-2 text-center text-sm font-medium">
              六维能力雷达图
            </div>
            <div className="flex justify-center">
              <ScoreRadar scores={scores} max={maxScores} />
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
            const max = maxScores[k] ?? SCORE_MAX[k];
            const val = scores[k] ?? 0;
            const pct = Math.min(100, (val / max) * 100);
            const comment = report.comments?.[k];
            return (
              <div
                key={k}
                className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-3"
              >
                <div className="flex items-baseline justify-between">
                  <div>
                    <div className="font-mono text-[11px] text-[var(--brand)]">
                      {k}
                    </div>
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
                    className={t.ok ? "text-[var(--ok)]" : "text-[var(--warn)]"}
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
                    <div className="mt-1 text-[var(--muted)]">
                      {item.evidence}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[var(--muted)]">
                本次没有可追溯的加分记录。
              </p>
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
    </div>
  );
}
