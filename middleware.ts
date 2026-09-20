import { NextRequest, NextResponse } from "next/server";

function allowedOrigins(request: NextRequest) {
  const fromEnv = (process.env.APP_ORIGINS || "")
    .split(",")
    .map((s) => s.trim().replace(/\/$/, ""))
    .filter(Boolean);

  const host =
    process.env.TRUST_PROXY === "true"
      ? request.headers.get("x-forwarded-host") ||
        request.headers.get("host") ||
        ""
      : request.headers.get("host") || "";

  const proto =
    request.headers.get("x-forwarded-proto") ||
    (process.env.NODE_ENV === "production" ? "https" : "http");

  const self = host ? `${proto}://${host}`.replace(/\/$/, "") : "";
  return new Set([...fromEnv, self].filter(Boolean));
}

export function middleware(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // 健康检查与本地开发默认不强制 Origin
  if (
    process.env.ENFORCE_APP_ORIGINS !== "true" ||
    request.nextUrl.pathname === "/api/health"
  ) {
    return NextResponse.next();
  }

  const origin = request.headers.get("origin");
  if (!origin) {
    // 同源导航/部分服务端请求可能无 Origin，放行 GET
    if (request.method === "GET" || request.method === "HEAD") {
      return NextResponse.next();
    }
    return NextResponse.json({ error: "Missing request origin" }, { status: 403 });
  }

  const originNorm = origin.replace(/\/$/, "");
  const allowed = allowedOrigins(request);
  if (!allowed.has(originNorm)) {
    return NextResponse.json(
      {
        error: "Invalid request origin",
        detail: { origin: originNorm },
      },
      { status: 403 }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
