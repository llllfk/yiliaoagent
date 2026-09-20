"use client";

import { cn } from "@/lib/utils";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger";
};

export function Button({
  className,
  variant = "primary",
  ...props
}: Props) {
  const styles =
    variant === "primary"
      ? "bg-[var(--brand)] text-white hover:opacity-90"
      : variant === "danger"
        ? "bg-[var(--danger)] text-white hover:opacity-90"
        : "bg-transparent text-[var(--ink)] border border-[var(--line)] hover:bg-black/5";

  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium disabled:opacity-50",
        styles,
        className
      )}
      {...props}
    />
  );
}
