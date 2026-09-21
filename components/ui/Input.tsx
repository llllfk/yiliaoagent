"use client";

import { cn } from "@/lib/utils";

type Props = React.InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, ...props }: Props) {
  return (
    <input
      className={cn(
        "w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2.5 text-sm outline-none transition placeholder:text-[var(--muted)] focus:border-[var(--brand-strong)] focus:ring-2 focus:ring-[var(--brand-soft)]",
        className
      )}
      {...props}
    />
  );
}
