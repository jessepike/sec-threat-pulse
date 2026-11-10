import { Suspense } from "react";
import { requireAdmin } from "@/lib/admin/session";
import { signOutAction } from "../signin/actions";
import { AdminSide } from "../_components/AdminNav";

const NAV = [
  ["/admin", "Overview"],
  ["/admin/roadmap", "Roadmap"],
  ["/admin/sources", "Sources"],
  ["/admin/runs", "Runs"],
  ["/admin/events", "Events"],
  ["/admin/rules", "Rules"],
  ["/admin/scorecard", "Scorecard"],
  ["/admin/corrections", "Corrections"],
  ["/admin/settings", "Settings"],
  ["/admin/audit", "Audit"],
] as const;

async function Shell({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  return (
    <div className="adm-shell">
      <AdminSide items={NAV}>
        <div className="adm-muted">Signed in as</div>
        <div className="adm-mono">{admin.login}</div>
        <form action={signOutAction}>
          <button className="adm-btn adm-btn-ghost" type="submit">
            Sign out
          </button>
        </form>
      </AdminSide>
      <main className="adm-main">{children}</main>
    </div>
  );
}

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="adm-loading">Loading</div>}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}
