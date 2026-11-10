"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Side navigation that marks the page you are on. */
export function AdminNav({ items }: { items: readonly (readonly [string, string])[] }) {
  const path = usePathname() ?? "";
  return (
    <nav aria-label="Admin">
      {items.map(([href, label]) => {
        const current = href === "/admin" ? path === "/admin" : path === href || path.startsWith(`${href}/`);
        return (
          <Link key={href} href={href} className="adm-nav" aria-current={current ? "page" : undefined}>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
