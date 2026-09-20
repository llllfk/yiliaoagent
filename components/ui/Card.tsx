import { cn } from "@/lib/utils";

export function Card({
  className,
  children,
  title,
}: {
  className?: string;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 shadow-sm",
        className
      )}
    >
      {title ? (
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-[var(--muted)]">
          {title}
        </h2>
      ) : null}
      {children}
    </section>
  );
}
