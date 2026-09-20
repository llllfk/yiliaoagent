import { redirect } from "next/navigation";
import { getSessionUser, homePathForRole } from "@/lib/auth";

export default async function HomePage() {
  try {
    const user = await getSessionUser();
    if (user) redirect(homePathForRole(user.role));
  } catch {
    // 数据库未就绪时仍去登录页
  }
  redirect("/login");
}
