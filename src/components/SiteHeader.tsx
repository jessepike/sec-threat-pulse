import Link from "next/link";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { Logo } from "./Logo";
import { THEME_COOKIE, parseTheme } from "./theme";
import { ThemeToggle } from "./ThemeToggle";

const NAV = [
  { key: "week", href: "/", label: "THIS WEEK" },
  { key: "events", href: "/events", label: "EVENTS" },
  { key: "vendors", href: "/vendors", label: "VENDORS" },
  { key: "record", href: "/track-record", label: "TRACK RECORD" },
  { key: "brief", href: "/brief", label: "BOARD BRIEF" },
] as const;

export type NavKey = (typeof NAV)[number]["key"] | "none";

/** The theme switch reads the saved choice, so it renders on the server with the right state. */
async function HeaderTheme() {
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return <ThemeToggle initial={theme} compact />;
}

export function SiteHeader({ active, strip }: { active: NavKey; strip: ReactNode }) {
  return (
    <header className="border-b border-line bg-header">
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 sm:px-6">
        <Link href="/" className="flex min-h-11 items-center gap-3 text-fg no-underline hover:text-fg">
          <Logo />
          <span className="font-mono text-[15px] font-bold tracking-[0.12em]">SECURITY_THREAT_PULSE</span>
        </Link>
        <nav aria-label="Main" className="-mx-2 flex flex-wrap items-center gap-0.5 font-mono text-[13px] tracking-[0.06em]">
          {NAV.map((n) => (
            <Link
              key={n.key}
              href={n.href}
              aria-current={active === n.key ? "page" : undefined}
              className={`px-2.5 py-3 no-underline hover:text-fg sm:px-3 ${n.key === "record" ? "max-sm:hidden" : ""} ${active === n.key ? "border-b-2 border-accent text-fg" : "border-b-2 border-transparent text-muted"}`}
            >
              {n.label}
            </Link>
          ))}
          <HeaderTheme />
        </nav>
      </div>
      <div className="border-t border-line-soft">{strip}</div>
    </header>
  );
}
