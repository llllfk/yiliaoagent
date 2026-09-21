import Link from "next/link";
import { LogoutButton } from "@/components/shared/LogoutButton";
import { EcgMark } from "@/components/shared/EcgMark";

export function TriageHeader({
  roleLabel,
  displayName,
  username,
  nav,
}: {
  roleLabel: string;
  displayName: string;
  username: string;
  nav?: Array<{ href: string; label: string }>;
}) {
  return (
    <header className="triage-header">
      <div className="flex min-w-0 items-center gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="live-dot" />
            <span className="font-display text-lg tracking-wide text-white">
              ER-Think
            </span>
            <span className="hidden font-mono text-[10px] tracking-[0.18em] text-teal-200/80 sm:inline">
              TRIAGE BOARD
            </span>
          </div>
          <div className="mt-0.5 truncate text-xs text-slate-300">
            {roleLabel} · {displayName}
            <span className="text-slate-500">（{username}）</span>
          </div>
        </div>
        <EcgMark className="hidden md:block" />
      </div>
      <div className="flex items-center gap-2">
        {nav?.map((item) => (
          <Link key={item.href} href={item.href} className="header-action">
            {item.label}
          </Link>
        ))}
        <LogoutButton />
      </div>
    </header>
  );
}
