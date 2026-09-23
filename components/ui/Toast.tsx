"use client";

import { useCallback, useState } from "react";

export type ToastTone = "info" | "ok" | "warn" | "crit";

export type ToastItem = {
  id: number;
  message: string;
  tone: ToastTone;
};

let toastSeq = 0;

export function useToasts() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const pushToast = useCallback(
    (message: string, tone: ToastTone = "info", ms = 3200) => {
      const text = message.trim();
      if (!text) return;
      const id = ++toastSeq;
      setToasts((prev) => [...prev.slice(-4), { id, message: text, tone }]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, ms);
    },
    []
  );

  return { toasts, pushToast, dismiss };
}

export function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
}) {
  if (toasts.length === 0) return null;
  return (
    <div className="toast-stack" aria-live="polite">
      {toasts.map((t) => (
        <button
          key={t.id}
          type="button"
          className={`toast-item is-${t.tone}`}
          onClick={() => onDismiss(t.id)}
        >
          {t.message}
        </button>
      ))}
    </div>
  );
}
