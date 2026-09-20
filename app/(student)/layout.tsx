import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { LogoutButton } from "@/components/shared/LogoutButton";

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let user = null;
  try {
    user = await getSessionUser();
  } catch {
    redirect("/login");
  }
  if (!user) redirect("/login");
  if (user.role !== "student") redirect("/dashboard");

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-[var(--line)] bg-white/80 px-4 py-3 backdrop-blur">
        <div>
          <div className="text-sm font-semibold">ER-Think 学生训练台</div>
          <div className="text-xs text-[var(--muted)]">
            {user.displayName}（{user.username}）
          </div>
        </div>
        <LogoutButton />
      </header>
      {children}
    </div>
  );
}
