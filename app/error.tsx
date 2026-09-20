"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-xl font-semibold">页面出错了</h1>
      <p className="text-sm text-[var(--muted)]">{error.message || "未知错误"}</p>
      <button
        type="button"
        onClick={reset}
        className="rounded-md bg-[var(--brand)] px-4 py-2 text-white"
      >
        重试
      </button>
    </div>
  );
}
