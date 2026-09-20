import { fail, ok } from "@/lib/api";
import { clearSessionCookie } from "@/lib/auth";

export async function POST() {
  try {
    await clearSessionCookie();
    return ok({ ok: true });
  } catch (error) {
    console.error(error);
    return fail("退出失败", 500);
  }
}
