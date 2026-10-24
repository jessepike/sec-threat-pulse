import { Suspense } from "react";
import { signInAction } from "./actions";
import { devBypassEnabled } from "@/lib/admin/allowlist";

export const metadata = { title: "Sign in" };

// Admin pages always render per request. (force-dynamic is replaced by this under Cache Components.)
export const dynamic = "force-dynamic";

async function Body({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <div className="adm-signin">
      <div className="adm-card adm-signin-card">
        <div className="adm-brand">
          <span className="adm-dot" />
          Security Threat Pulse
        </div>
        <h1>Admin sign in</h1>
        <p className="adm-muted">Private console. Only approved GitHub accounts can sign in.</p>
        {error ? (
          <p className="adm-flash adm-flash-error" role="alert">
            {error === "AccessDenied"
              ? "That GitHub account is not on the admin list."
              : "Sign in failed. Try again."}
          </p>
        ) : null}
        <form action={signInAction}>
          <button className="adm-btn adm-btn-primary" type="submit">
            Sign in with GitHub
          </button>
        </form>
        {devBypassEnabled() ? (
          <p className="adm-muted adm-small">Dev bypass is on. Open /admin directly.</p>
        ) : null}
      </div>
    </div>
  );
}

export default function SignInPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  return (
    <Suspense fallback={null}>
      <Body searchParams={searchParams} />
    </Suspense>
  );
}
