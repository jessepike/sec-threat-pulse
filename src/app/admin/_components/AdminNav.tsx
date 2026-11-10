"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

/**
 * The side menu. It marks the page you are on. On a phone it is one bar with a Menu button, and
 * choosing a page closes it.
 */
export function AdminSide({ items, children }: { items: readonly (readonly [string, string])[]; children: ReactNode }) {
  const path = usePathname() ?? "";
  const [open, setOpen] = useState(false);
  const isCurrent = (href: string) => (href === "/admin" ? path === "/admin" : path === href || path.startsWith(`${href}/`));
  const here = items.find(([href]) => isCurrent(href))?.[1];
  return (
    <aside className="adm-side" data-open={open}>
      <div className="adm-sidehead">
        <div className="adm-brand">
          <span className="adm-dot" />
          STP Admin
        </div>
        <button type="button" className="adm-btn adm-menu-btn" aria-expanded={open} aria-controls="adm-menu" onClick={() => setOpen((v) => !v)}>
          {open ? "Close" : here ? `Menu: ${here}` : "Menu"}
        </button>
      </div>
      <div id="adm-menu" className="adm-menu">
        <nav aria-label="Admin">
          {items.map(([href, label]) => (
            <Link key={href} href={href} className="adm-nav" aria-current={isCurrent(href) ? "page" : undefined} onClick={() => setOpen(false)}>
              {label}
            </Link>
          ))}
        </nav>
        <div className="adm-user">{children}</div>
      </div>
    </aside>
  );
}
