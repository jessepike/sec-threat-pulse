import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

// Next.js injects small inline scripts for hydration, so script-src needs 'unsafe-inline'
// until a nonce-based policy is added. Fonts are self-hosted by next/font, so no font origins.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  // Sign-in posts to /api/auth and redirects to GitHub; Chrome applies form-action to the redirect.
  "form-action 'self' https://github.com",
  "frame-ancestors 'none'",
  ...(isProd ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  outputFileTracingIncludes: {
    "/admin/roadmap": ["./BACKLOG.md"],
    "/api/cron/migrate": ["./drizzle/**/*"],
    "/api/cron/ingest": ["./drizzle/**/*"],
    "/api/cron/events": ["./drizzle/**/*"],
    "/methodology": ["./docs/methodology-rules.md"],
    "/llms-full.txt": ["./docs/methodology-rules.md"],
    "/admin/rules": ["./reports/backtest/*.json", "./reports/backtest/heldout-reveals.log"],
    "/admin/scorecard": ["./reports/backtest/*.json", "./intent.md"],
    "/track-record": ["./reports/backtest/*.json"],
    "/api/v1/track-record": ["./reports/backtest/*.json"],
    "/api/mcp": ["./reports/backtest/*.json"],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
