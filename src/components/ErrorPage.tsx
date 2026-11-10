import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "./Logo";

const BTN_PRIMARY = "rounded-[3px] bg-accent px-5 py-3.5 font-mono text-sm font-bold tracking-[0.06em] text-accent-ink no-underline hover:bg-accent-hover hover:text-accent-ink cursor-pointer border-0";
const BTN_SECONDARY = "rounded-[3px] border border-line-strong bg-transparent px-5 py-[13px] font-mono text-sm tracking-[0.06em] text-fg no-underline hover:text-fg cursor-pointer";

/** A small header that needs no data, so error pages can always render it. */
export function PlainHeader() {
  return (
    <header className="border-b border-line bg-header">
      <div className="mx-auto flex max-w-[1280px] items-center px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-3 text-fg no-underline hover:text-fg">
          <Logo />
          <span className="font-mono text-[15px] font-bold tracking-[0.12em]">SECURITY_THREAT_PULSE</span>
        </Link>
      </div>
    </header>
  );
}

export function MessagePage({ code, title, children, actions }: { code: string; title: string; children: ReactNode; actions: ReactNode }) {
  return (
    <main id="main" className="mx-auto flex max-w-[720px] flex-col gap-5 px-4 py-20 sm:px-6">
      <div className="font-mono text-xs tracking-[0.1em] text-muted">{code}</div>
      <h1 className="m-0 font-display text-4xl font-bold leading-[1.05] tracking-[-0.03em] sm:text-5xl">{title}</h1>
      <div className="flex flex-col gap-3 text-base leading-[1.6] text-fg-2">{children}</div>
      <div className="flex flex-wrap gap-3 pt-2">{actions}</div>
    </main>
  );
}

export function NotFoundContent() {
  return (
    <MessagePage
      code="// ERROR 404"
      title="Page not found"
      actions={
        <>
          <Link href="/" className={BTN_PRIMARY}>THIS WEEK</Link>
          <Link href="/events" className={BTN_SECONDARY}>ALL EVENTS</Link>
        </>
      }
    >
      <p className="m-0">We have no event or page at this address. The link may be old, or the event may have been removed.</p>
      <p className="m-0">
        You can also read the <Link href="/methodology">methodology</Link> or the <Link href="/corrections">corrections log</Link>.
      </p>
    </MessagePage>
  );
}

export function ErrorContent({ digest, reset }: { digest?: string; reset: () => void }) {
  return (
    <MessagePage
      code="// ERROR"
      title="Data is not available right now"
      actions={
        <>
          <button type="button" onClick={reset} className={BTN_PRIMARY}>TRY AGAIN</button>
          <Link href="/" className={BTN_SECONDARY}>THIS WEEK</Link>
        </>
      }
    >
      <p className="m-0">The page could not load its data. This is a fault on our side. Nothing you did caused it. Try again in a few minutes.</p>
      {digest ? <p className="m-0 font-mono text-xs text-faint">REFERENCE {digest}</p> : null}
    </MessagePage>
  );
}
