import type { ReactNode } from "react";

export type SP = Promise<Record<string, string | string[] | undefined>>;

export function one(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

export function Flash({ sp }: { sp: Record<string, string | string[] | undefined> }) {
  const ok = one(sp.ok);
  const error = one(sp.error);
  if (!ok && !error) return null;
  return (
    <p className={`adm-flash ${error ? "adm-flash-error" : "adm-flash-ok"}`} role={error ? "alert" : "status"}>
      {error || ok}
    </p>
  );
}

export function NoDb() {
  return (
    <div className="adm-card adm-empty">
      <strong>Database not connected</strong>
      <p className="adm-muted">
        Set DATABASE_URL to see live data here. Nothing is lost; this page shows data once the database is connected.
      </p>
    </div>
  );
}

export function PageHead({ title, sub, children }: { title: string; sub?: string; children?: ReactNode }) {
  return (
    <header className="adm-head">
      <div>
        <h1>{title}</h1>
        {sub ? <p className="adm-muted">{sub}</p> : null}
      </div>
      {children}
    </header>
  );
}

const VERDICT_CLASS: Record<string, string> = { act_now: "act", watch: "watch", low: "low" };
const VERDICT_TEXT: Record<string, string> = { act_now: "Act now", watch: "Watch", low: "Low" };

export function VerdictPill({ verdict }: { verdict: string }) {
  return <span className={`adm-pill adm-pill-${VERDICT_CLASS[verdict] ?? "low"}`}>{VERDICT_TEXT[verdict] ?? verdict}</span>;
}

export function StatusPill({ status }: { status: string }) {
  const cls = status === "ok" ? "low" : status === "error" ? "act" : "watch";
  return <span className={`adm-pill adm-pill-${cls}`}>{status}</span>;
}

/** Fixed UTC format so server and browser agree. */
export function fmt(d: Date | string | null | undefined): string {
  if (!d) return "never";
  const iso = (typeof d === "string" ? new Date(d) : d).toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)}Z`;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="adm-muted adm-empty-row">{children}</p>;
}
