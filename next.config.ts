import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";

/** Coze 预览/部署需放行平台脚本与热更新（见 github导入coze注意事项） */
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "form-action 'self'",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  "connect-src 'self' https:",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://lf-cdn.coze.cn",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  isProduction ? "upgrade-insecure-requests" : "",
]
  .filter(Boolean)
  .join("; ");

const nextConfig: NextConfig = {
  // 禁止 standalone，Coze 使用 next start
  poweredByHeader: false,
  // 避免 Coze CDN 对 (route-group) / [id] 路径编码后 chunk 404
  async redirects() {
    return [
      {
        source: "/sessions/:id(\\d+)",
        destination: "/sessions?id=:id",
        permanent: false,
      },
      {
        source: "/history/:id(\\d+)",
        destination: "/history/detail?id=:id",
        permanent: false,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
