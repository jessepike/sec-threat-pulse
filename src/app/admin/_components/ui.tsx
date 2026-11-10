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
      {children ? <div className="adm-inline">{children}</div> : null}
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

/** "12 min ago", "3 h ago", "5 d ago". Past times only; a time in the future reads "just now". */
export function ago(d: Date | string | null | undefined, now: Date = new Date()): string {
  if (!d) return "never";
  const mins = Math.max(0, Math.round((now.getTime() - new Date(d).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 90) return `${mins} min ago`;
  if (mins < 2880) return `${Math.round(mins / 60)} h ago`;
  return `${Math.round(mins / 1440)} d ago`;
}

/** A relative time with the exact UTC time on hover and for screen readers. */
export function Ago({ d, now }: { d: Date | string | null | undefined; now?: Date }) {
  if (!d) return <span className="adm-muted">never</span>;
  return (
    <time dateTime={new Date(d).toISOString()} title={fmt(d)} className="adm-nowrap">
      {ago(d, now)}
    </time>
  );
}

/** A card that folds. The summary line shows what is inside. */
export function Fold({ title, hint, open, children }: { title: string; hint?: ReactNode; open?: boolean; children: ReactNode }) {
  return (
    <details className="adm-card adm-fold" open={open}>
      <summary>
        <span>{title}</span>
        {hint ? <span className="adm-hint adm-muted adm-small">{hint}</span> : null}
      </summary>
      {children}
    </details>
  );
}
