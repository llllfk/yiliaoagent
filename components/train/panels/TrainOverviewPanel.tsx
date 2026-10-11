"use client";

import { Card } from "@/components/ui/Card";
import { VitalsPanel } from "@/components/train/VitalsPanel";
import { useTrainSession } from "@/components/train/TrainSessionContext";
import { formatWallClock } from "@/components/train/train-shared";

function patientField(
  patient: Record<string, unknown> | undefined,
  ...keys: string[]
): string {
  if (!patient) return "";
  for (const key of keys) {
    const v = patient[key];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return "";
}

export function TrainOverviewPanel() {
  const {
    caseConfig,
    state,
    wallStartedAt,
    wallNow,
    currentVitals,
  } = useTrainSession();

  const patient = caseConfig.patient || {};
  const patientName = patientField(patient, "name", "姓名");
  const patientAge = patientField(patient, "age", "年龄");
  const patientGender = patientField(patient, "gender", "sex", "性别");
  const patientOccupation = patientField(patient, "occupation", "职业");
  const patientChief = patientField(patient, "chief", "chiefComplaint", "主诉");

  return (
    <div className="space-y-4 animate-fade-up">
      <Card title="患者基本信息" eyebrow="Patient">
        <div className="space-y-2 text-sm">
          <div className="font-display text-lg leading-snug">
            {caseConfig.title}
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs text-[var(--muted)] sm:grid-cols-4">
            {patientName ? (
              <div className="rounded-lg bg-[var(--panel)] px-2 py-2">
                姓名
                <div className="text-[var(--ink)]">{patientName}</div>
              </div>
            ) : null}
            {patientAge ? (
              <div className="rounded-lg bg-[var(--panel)] px-2 py-2">
                年龄
                <div className="text-[var(--ink)]">
                  {/岁$/.test(patientAge) ? patientAge : `${patientAge} 岁`}
                </div>
              </div>
            ) : null}
            {patientGender ? (
              <div className="rounded-lg bg-[var(--panel)] px-2 py-2">
                性别
                <div className="text-[var(--ink)]">{patientGender}</div>
              </div>
            ) : null}
            {patientOccupation ? (
              <div className="rounded-lg bg-[var(--panel)] px-2 py-2">
                职业
                <div className="text-[var(--ink)]">{patientOccupation}</div>
              </div>
            ) : null}
            <div className="rounded-lg bg-[var(--panel)] px-2 py-2">
              编号
              <div className="font-mono text-[var(--ink)]">{caseConfig.code}</div>
            </div>
            <div className="rounded-lg bg-[var(--panel)] px-2 py-2">
              难度
              <div className="text-[var(--ink)]">{caseConfig.difficulty}</div>
            </div>
            <div className="rounded-lg bg-[var(--panel)] px-2 py-2">
              目标时长
              <div className="text-[var(--ink)]">{caseConfig.targetMinutes} 分钟</div>
            </div>
            <div className="rounded-lg bg-[var(--panel)] px-2 py-2">
              状态
              <div className="text-[var(--ink)]">
                {state.finished ? "已结束" : "进行中"}
              </div>
            </div>
          </div>
          {patientChief ? (
            <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5 text-sm">
              <div className="mb-1 text-xs text-[var(--muted)]">主诉</div>
              <div className="leading-relaxed text-[var(--ink)]">{patientChief}</div>
            </div>
          ) : null}
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
          <p className="text-xs leading-relaxed text-[var(--muted)]">
            建议先完成问诊与检查，再在「检查」页底部进行继续观察与病情处置。
          </p>
        </div>
      </Card>

      {currentVitals ? <VitalsPanel resolved={currentVitals} /> : null}
    </div>
  );
}
