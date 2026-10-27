"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { productName } from "@/lib/ladder/plain-title";
import type { Verdict } from "@/lib/ladder/types";
import { VerdictBadge } from "./ui";

const KEY = "stp.vendors.v1";

interface ApiEvent {
  id: string;
  title: string;
  verdict: Verdict;
  vendor: string | null;
  category?: { label: string; doThis: string };
}

function readSaved(): string[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === "string").slice(0, 200) : [];
  } catch {
    return [];
  }
}

function save(list: string[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // Private windows can refuse storage; the choice then lasts for this visit only.
  }
}

async function loadAll(): Promise<ApiEvent[]> {
  const out: ApiEvent[] = [];
  for (let page = 1; page <= 10; page++) {
    const res = await fetch(`/api/v1/events?page=${page}`);
    if (!res.ok) break;
    const d = (await res.json()) as { events: ApiEvent[]; pages: number };
    out.push(...d.events);
    if (page >= d.pages) break;
  }
  return out;
}

const vendorOf = (e: ApiEvent) => productName(e.vendor, null);

/**
 * "Vendors I use": the reader ticks the vendors their organization runs and sees only the tracked
 * events for those vendors. The choice is kept in this browser only. Nothing is sent to us.
 */
export function YourVendors() {
  const [saved, setSaved] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState<ApiEvent[] | null>(null);
  const [error, setError] = useState(false);

  // Browser storage is read after hydration so the server and first client render match.
  useEffect(() => {
    let live = true;
    queueMicrotask(() => {
      if (!live) return;
      const s = readSaved();
      setSaved(s);
      if (s.length) loadAll().then((e) => live && setEvents(e), () => live && setError(true));
    });
    return () => {
      live = false;
    };
  }, []);

  const startChoosing = () => {
    setOpen(true);
    if (!events) loadAll().then(setEvents, () => setError(true));
  };

  const vendors = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of events ?? []) {
      const v = vendorOf(e);
      if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [events]);

  const chosen = new Set(saved);
  const matches = (events ?? []).filter((e) => chosen.has(vendorOf(e)));

  const toggle = (v: string) => {
    const next = chosen.has(v) ? saved.filter((x) => x !== v) : [...saved, v].sort((a, b) => a.localeCompare(b));
    setSaved(next);
    save(next);
  };

  return (
    <section aria-labelledby="yv" className="flex flex-col gap-4 rounded border border-line bg-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="yv" className="m-0 font-mono text-[13px] font-bold tracking-[0.1em] text-muted">
          VENDORS YOU USE{saved.length ? ` · ${saved.length} CHOSEN` : ""}
        </h2>
        <button
          type="button"
          onClick={() => (open ? setOpen(false) : startChoosing())}
          aria-expanded={open}
          className="rounded-[3px] border border-line-strong bg-transparent px-4 py-2 font-mono text-xs font-bold tracking-[0.06em] text-fg hover:border-accent"
        >
          {open ? "DONE" : saved.length ? "CHANGE" : "CHOOSE VENDORS"}
        </button>
      </div>

      {!saved.length && !open && (
        <p className="m-0 text-[15px] leading-normal text-fg-2">
          Pick the vendors your organization uses to see only the events that apply to you. Your list stays in this browser.
        </p>
      )}

      {open && (
        <div className="flex flex-col gap-3">
          {error && <p className="m-0 text-[15px] text-muted">The vendor list could not load. Try again later.</p>}
          {!events && !error && <p className="m-0 text-[15px] text-muted">Loading vendors…</p>}
          {events && (
            <fieldset className="m-0 grid grid-cols-[repeat(auto-fill,minmax(min(100%,220px),1fr))] gap-x-4 gap-y-2 border-0 p-0">
              <legend className="sr-only">Vendors with tracked events</legend>
              {vendors.map(([v, n]) => (
                <label key={v} className="flex cursor-pointer items-center gap-2 text-[15px] text-fg-2">
                  <input type="checkbox" checked={chosen.has(v)} onChange={() => toggle(v)} className="size-4 accent-[var(--color-accent)]" />
                  <span className="min-w-0 [overflow-wrap:anywhere]">
                    {v} <span className="font-mono text-xs text-faint">{n}</span>
                  </span>
                </label>
              ))}
            </fieldset>
          )}
        </div>
      )}

      {saved.length > 0 && !open && events && (
        matches.length === 0 ? (
          <p className="m-0 text-[15px] leading-normal text-fg-2">None of your vendors has a tracked event right now.</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {matches.map((e) => (
              <li key={e.id} className="flex flex-col gap-1.5 border-t border-line-soft pt-3 first:border-t-0 first:pt-0">
                <div className="flex flex-wrap items-center gap-3">
                  <VerdictBadge verdict={e.verdict} />
                  <Link href={`/events/${e.id}`} className="font-display text-base font-semibold text-fg no-underline hover:text-accent">
                    {e.title}
                  </Link>
                </div>
                {e.category && (
                  <p className="m-0 text-[15px] leading-normal text-fg-2">
                    <span className="font-mono text-xs tracking-[0.08em] text-accent">DO THIS </span>
                    {e.category.doThis}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )
      )}
    </section>
  );
}
