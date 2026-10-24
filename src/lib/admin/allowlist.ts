/** Parse the comma-separated ADMIN_GITHUB_LOGINS value. GitHub logins are case-insensitive. */
export function parseAllowlist(raw: string | undefined | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/** True only when the login is in the allowlist. An empty allowlist rejects everyone. */
export function isAllowedLogin(
  login: unknown,
  raw: string | undefined | null = process.env.ADMIN_GITHUB_LOGINS,
): boolean {
  if (typeof login !== "string" || !login.trim()) return false;
  return parseAllowlist(raw).includes(login.trim().toLowerCase());
}

/** Test-only auth bypass. Never active in production builds. */
export function devBypassEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.ADMIN_DEV_BYPASS === "1" && env.NODE_ENV !== "production";
}
