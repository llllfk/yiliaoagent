import { fail, ok } from "@/lib/api";
import { AuthError, getSessionUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return fail("未登录", 401);
    return ok({ user });
  } catch (error) {
    if (error instanceof AuthError) {
      return fail(error.message, error.status);
    }
    console.error(error);
    return fail("获取用户失败", 500);
  }
}
