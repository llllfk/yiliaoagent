import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { TriageHeader } from "@/components/shared/TriageHeader";

export async function TeacherAppLayout({
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
  if (user.role !== "teacher") redirect("/train");

  return (
    <div className="app-shell">
      <TriageHeader
        roleLabel="教师端"
        displayName={user.displayName}
        username={user.username}
        nav={[
          { href: "/dashboard", label: "成绩看板" },
          { href: "/cases", label: "病例导入" },
          { href: "/students", label: "学生管理" },
        ]}
      />
      {children}
    </div>
  );
}
