import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import {
  AuthError,
  homePathForRole,
  setSessionCookie,
  verifyPassword,
} from "@/lib/auth";
import { query } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      username?: string;
      password?: string;
    };
    const username = body.username?.trim();
    const password = body.password || "";
    if (!username || !password) {
      return fail("请输入账号和密码");
    }

    const result = await query<{
      id: string;
      tenant_id: string;
      password_hash: string;
      display_name: string;
      role: "teacher" | "student";
      is_active: boolean;
    }>(
      `SELECT id, tenant_id, password_hash, display_name, role, is_active
       FROM users
       WHERE username = $1
       LIMIT 1`,
      [username]
    );

    const user = result.rows[0];
    if (!user || !user.is_active) {
      return fail("账号或密码错误", 401);
    }

    const passOk = await verifyPassword(password, user.password_hash);
    if (!passOk) {
      return fail("账号或密码错误", 401);
    }

    await setSessionCookie(Number(user.id), Number(user.tenant_id));

    return ok({
      user: {
        id: Number(user.id),
        tenantId: Number(user.tenant_id),
        username,
        displayName: user.display_name,
        role: user.role,
      },
      redirectTo: homePathForRole(user.role),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return fail(error.message, error.status);
    }
    console.error(error);
    return fail("登录失败，请检查数据库连接", 500);
  }
}
