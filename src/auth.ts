import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { isAllowedLogin } from "@/lib/admin/allowlist";

declare module "next-auth" {
  interface Session {
    /** GitHub login of the signed-in admin. */
    login?: string;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [GitHub],
  session: { strategy: "jwt", maxAge: 60 * 60 * 12 },
  trustHost: true,
  pages: { signIn: "/admin/signin", error: "/admin/signin" },
  callbacks: {
    // Reject everyone who is not on the allowlist before a session exists.
    signIn({ profile }) {
      return isAllowedLogin((profile as { login?: string } | undefined)?.login);
    },
    jwt({ token, profile }) {
      const login = (profile as { login?: string } | undefined)?.login;
      if (login) token.login = login;
      return token;
    },
    session({ session, token }) {
      session.login = typeof token.login === "string" ? token.login : undefined;
      return session;
    },
  },
});
