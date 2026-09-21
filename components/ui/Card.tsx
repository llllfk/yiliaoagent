import { cn } from "@/lib/utils";

export function Card({
  className,
  children,
  title,
  eyebrow,
}: {
  className?: string;
  children: React.ReactNode;
  title?: string;
  eyebrow?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel-strong)] p-4 shadow-[var(--shadow)]",
        className
      )}
    >
      {title ? (
        <header className="mb-3 border-b border-[var(--line)] pb-2">
          {eyebrow ? (
            <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--brand)]">
              {eyebrow}
            </div>
          ) : null}
          <h2 className="text-[15px] font-semibold tracking-wide text-[var(--ink)]">
            {title}
          </h2>
        </header>
      ) : null}
      {children}
    </section>
  );
}
