import Link from "next/link";
import type { ReactNode } from "react";

const NAV = [
  { key: "week", href: "/", label: "THIS WEEK" },
  { key: "events", href: "/events", label: "EVENTS" },
  { key: "vendors", href: "/vendors", label: "VENDORS" },
  { key: "trends", href: "/#trends", label: "TRENDS" },
  { key: "brief", href: "/brief", label: "BOARD BRIEF" },
] as const;

export type NavKey = (typeof NAV)[number]["key"] | "none";

export function Logo({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden="true">
      <rect x="0.5" y="0.5" width="27" height="27" rx="4" fill="none" stroke="var(--line-strong)" />
      <path d="M4 14h5l2.5-6 5 12 2.5-6h5" fill="none" stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SiteHeader({ active, strip }: { active: NavKey; strip: ReactNode }) {
  return (
    <header className="border-b border-line bg-header">
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-3 text-fg no-underline hover:text-fg">
          <Logo />
          <span className="font-mono text-[15px] font-bold tracking-[0.12em]">SECURITY_THREAT_PULSE</span>
        </Link>
        <nav aria-label="Main" className="-mx-2 flex flex-wrap gap-0.5 font-mono text-[13px] tracking-[0.06em]">
          {NAV.map((n) => (
            <Link
              key={n.key}
              href={n.href}
              aria-current={active === n.key ? "page" : undefined}
              className={`px-2.5 py-3 no-underline hover:text-fg sm:px-3 ${n.key === "trends" ? "max-sm:hidden" : ""} ${active === n.key ? "border-b-2 border-accent text-fg" : "border-b-2 border-transparent text-muted"}`}
            >
              {n.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="border-t border-line-soft">{strip}</div>
    </header>
  );
}
