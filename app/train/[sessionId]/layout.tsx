"use client";

import { useParams } from "next/navigation";
import { TrainSessionProvider } from "@/components/train/TrainSessionContext";
import { TrainSideNav } from "@/components/train/TrainSideNav";

export default function TrainSessionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const raw = params?.sessionId;
  const sessionId = Number(Array.isArray(raw) ? raw[0] : raw);

  if (!Number.isFinite(sessionId) || sessionId <= 0) {
    return (
      <main className="p-6 text-sm text-[var(--crit)]">无效的训练会话</main>
    );
  }

  return (
    <TrainSessionProvider sessionId={sessionId}>
      <main className="mx-auto grid max-w-[1440px] gap-4 p-4 lg:grid-cols-[240px_1fr]">
        <div className="lg:sticky lg:top-4 lg:self-start">
          <TrainSideNav />
        </div>
        <div className="min-w-0">{children}</div>
      </main>
    </TrainSessionProvider>
  );
}
