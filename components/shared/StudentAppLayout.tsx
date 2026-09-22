import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { TriageHeader } from "@/components/shared/TriageHeader";

export async function StudentAppLayout({
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
    <div className="app-shell">
      <TriageHeader
        roleLabel="学生训练台"
        displayName={user.displayName}
        username={user.username}
        nav={[
          { href: "/train", label: "开始训练" },
          { href: "/history", label: "我的记录" },
        ]}
      />
      {children}
    </div>
  );
}
