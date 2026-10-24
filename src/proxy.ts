import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { devBypassEnabled, isAllowedLogin } from "@/lib/admin/allowlist";

// Server-side gate for the admin console and admin API. Every server action and route
// handler also checks the session itself (see src/lib/admin/session.ts).
export default auth((req) => {
  const { pathname } = req.nextUrl;
  if (pathname === "/admin/signin") return NextResponse.next();
  if (devBypassEnabled()) return NextResponse.next();

  const ok = isAllowedLogin(req.auth?.login);
  if (ok) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/admin/signin", req.nextUrl.origin));
});

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
