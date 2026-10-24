import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { devBypassEnabled, isAllowedLogin } from "./allowlist";

export interface AdminUser {
  login: string;
}

/** Returns the signed-in, allowlisted admin, or null. Re-checks the allowlist on every call. */
export async function getAdmin(): Promise<AdminUser | null> {
  if (devBypassEnabled()) return { login: "dev-bypass" };
  const session = await auth();
  const login = session?.login;
  if (login && isAllowedLogin(login)) return { login };
  return null;
}

/** For pages and server actions: redirects to sign-in when not an admin. */
export async function requireAdmin(): Promise<AdminUser> {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/signin");
  return admin;
}
