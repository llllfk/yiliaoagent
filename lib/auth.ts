import { createHash, randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { query } from "@/lib/db";
import type { AuthUser, UserRole } from "@/types";

const COOKIE_NAME =
  process.env.NODE_ENV === "production"
    ? "__Host-er_think_session"
    : "er_think_session";

const ABSOLUTE_TTL_MS = 15 * 24 * 60 * 60 * 1000;
const IDLE_TTL_MS = 48 * 60 * 60 * 1000;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

export async function setSessionCookie(userId: number, tenantId: number) {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + ABSOLUTE_TTL_MS);

  await query(
    `INSERT INTO auth_sessions (user_id, tenant_id, token_hash, expires_at, last_seen_at)
     VALUES ($1, $2, $3, $4, NOW())`,
    [userId, tenantId, tokenHash, expiresAt.toISOString()]
  );

  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (token) {
    await query(`DELETE FROM auth_sessions WHERE token_hash = $1`, [
      hashToken(token),
    ]);
  }
  jar.set(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
  });
}

export async function getSessionUser(): Promise<AuthUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const tokenHash = hashToken(token);
  const result = await query<{
    user_id: string;
    tenant_id: string;
    username: string;
    display_name: string;
    role: UserRole;
    expires_at: Date;
    last_seen_at: Date;
  }>(
    `SELECT s.user_id, s.tenant_id, s.expires_at, s.last_seen_at,
            u.username, u.display_name, u.role
     FROM auth_sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1
       AND u.is_active = TRUE
     LIMIT 1`,
    [tokenHash]
  );

  const row = result.rows[0];
  if (!row) return null;

  const expiresAt = new Date(row.expires_at).getTime();
  const lastSeen = new Date(row.last_seen_at).getTime();
  if (Date.now() > expiresAt || Date.now() - lastSeen > IDLE_TTL_MS) {
    await query(`DELETE FROM auth_sessions WHERE token_hash = $1`, [tokenHash]);
    return null;
  }

  await query(`UPDATE auth_sessions SET last_seen_at = NOW() WHERE token_hash = $1`, [
    tokenHash,
  ]);

  return {
    id: Number(row.user_id),
    tenantId: Number(row.tenant_id),
    username: row.username,
    displayName: row.display_name,
    role: row.role,
  };
}

export async function requireSession(roles?: UserRole[]): Promise<AuthUser> {
  const user = await getSessionUser();
  if (!user) {
    throw new AuthError("未登录", 401);
  }
  if (roles && !roles.includes(user.role)) {
    throw new AuthError("无权访问", 403);
  }
  return user;
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function homePathForRole(role: UserRole) {
  return role === "teacher" ? "/dashboard" : "/train";
}
