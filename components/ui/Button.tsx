"use client";

import { cn } from "@/lib/utils";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger" | "amber";
  size?: "sm" | "md";
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: Props) {
  const styles =
    variant === "primary"
      ? "bg-[var(--brand)] text-white hover:bg-[var(--brand-strong)]"
      : variant === "danger"
        ? "bg-[var(--danger)] text-white border-transparent hover:brightness-110"
        : variant === "amber"
          ? "bg-[var(--amber)] text-white hover:brightness-110"
          : "bg-[var(--panel)] text-[var(--ink)] border border-[var(--line)] hover:border-[var(--brand)] hover:text-[var(--brand)]";

  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-md font-medium transition disabled:cursor-not-allowed disabled:opacity-45",
        size === "sm"
          ? "box-border h-7 border px-2 text-xs leading-none"
          : "rounded-lg px-3.5 py-2 text-sm",
        styles,
        className
      )}
      {...props}
    />
  );
}
