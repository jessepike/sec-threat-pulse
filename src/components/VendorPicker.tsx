"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { canonVendorKey, stackHit, stackHref } from "@/lib/data/vendors";
import { VERDICT_STYLE } from "./ui";

/** The last list this browser built, as vendor keys. */
export const STACK_KEY = "stp.stack.v1";
/** The older browser-only picker stored vendor names under this key. Read once, then removed. */
const OLD_KEY = "stp.vendors.v1";

export interface PickerVendor {
  key: string;
  name: string;
  actNow: number;
  watch: number;
  total: number;
  /** Up to three product names and how many more there are. */
  products: string[];
  more: number;
  /** Every product family name, lower case, for the filter box. */
  search: string;
  actNowIds: string[];
  watchIds: string[];
}

export function readSavedStack(): string[] {
  try {
    const raw = window.localStorage.getItem(STACK_KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === "string" && /^[a-z0-9]{2,60}$/.test(x)).slice(0, 25) : [];
  } catch {
    return [];
  }
}

function readOldNames(): string[] {
  try {
    const raw = window.localStorage.getItem(OLD_KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === "string").map(canonVendorKey) : [];
  } catch {
    return [];
  }
}

function save(keys: string[]) {
  try {
    if (keys.length) window.localStorage.setItem(STACK_KEY, JSON.stringify(keys));
    else window.localStorage.removeItem(STACK_KEY);
    window.localStorage.removeItem(OLD_KEY);
  } catch {
    // Private windows can refuse storage. The address still holds the list.
  }
}

const MAX = 25;

/**
 * The vendors page. Ticking a vendor adds it to the page address (?stack=), so the list can be
 * bookmarked or shared, and this browser remembers the last address. The server renders the same
 * list from the address, so the page reads the same without scripts.
 */
export function VendorPicker({ vendors, initial }: { vendors: PickerVendor[]; initial: string[] }) {
  // Entries an agent typed ("paloalto") become the vendor keys they match, so every tick maps to one card.
  const resolve = (entries: string[]) => {
    const keys = entries.flatMap((e) => vendors.filter((v) => stackHit(e, v.key)).map((v) => v.key));
    return [...new Set(keys)].slice(0, MAX);
  };
  const [stack, setStack] = useState<string[]>(() => resolve(initial));
  const [missing] = useState<string[]>(() => initial.filter((e) => !vendors.some((v) => stackHit(e, v.key))));
  const [query, setQuery] = useState("");

  // With no list in the address, pick up the one this browser saved last.
  useEffect(() => {
    if (initial.length) {
      save(resolve(initial));
      return;
    }
    queueMicrotask(() => {
      const saved = readSavedStack();
      const old = saved.length ? [] : readOldNames();
      const next = resolve(saved.length ? saved : old);
      if (!next.length) return;
      setStack(next);
      save(next);
      window.history.replaceState(null, "", stackHref(next));
    });
    // Runs once on load: the address the page arrived with decides.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chosen = useMemo(() => new Set(stack), [stack]);
  const update = (next: string[]) => {
    setStack(next);
    save(next);
    window.history.replaceState(null, "", stackHref(next));
  };
  const toggle = (key: string) => update(chosen.has(key) ? stack.filter((k) => k !== key) : stack.length < MAX ? [...stack, key] : stack);

  const mine = vendors.filter((v) => chosen.has(v.key));
  const actNow = new Set(mine.flatMap((v) => v.actNowIds)).size;
  const watch = new Set(mine.flatMap((v) => v.watchIds)).size;
  const q = query.trim().toLowerCase();
  const shown = q ? vendors.filter((v) => v.name.toLowerCase().includes(q) || v.search.includes(q)) : vendors;

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="mine-h" className="flex flex-col gap-4 rounded border border-line bg-surface p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="mine-h" className="m-0 font-mono text-[13px] font-bold tracking-[0.1em] text-muted" aria-live="polite">
            YOUR VENDORS · {mine.length} CHOSEN{mine.length ? ` · ${actNow} ACT NOW · ${watch} WATCH` : ""}
          </h2>
          {mine.length > 0 && (
            <button type="button" onClick={() => update([])} className="min-h-11 cursor-pointer rounded-[3px] border border-line-strong bg-transparent px-4 font-mono text-xs font-bold tracking-[0.06em] text-fg hover:border-accent">
              CLEAR
            </button>
          )}
        </div>
        {mine.length === 0 ? (
          <p className="m-0 text-[15px] leading-normal text-fg-2">
            Tick the vendors your organization uses. Your list goes into this page&apos;s address, so you can bookmark it or send it to a colleague. This browser also
            remembers it for your next visit.
          </p>
        ) : (
          <ul className="m-0 flex list-none flex-col p-0">
            {mine.map((v) => (
              <li key={v.key} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-line-soft py-2 first:border-t-0">
                <Link href={`/vendors/${v.key}`} className="py-2 font-display text-base font-semibold text-fg no-underline hover:text-accent">
                  {v.name}
                </Link>
                <Counts v={v} />
              </li>
            ))}
          </ul>
        )}
        {missing.length > 0 && <p className="m-0 text-[15px] text-muted">No tracked event names {missing.join(", ")}.</p>}
      </section>

      <section aria-labelledby="all-h" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 id="all-h" className="m-0 font-mono text-[13px] font-bold tracking-[0.1em] text-muted">
            ALL VENDORS · {q ? `${shown.length} OF ${vendors.length}` : vendors.length}
          </h2>
          <label className="flex min-w-0 flex-[0_1_320px] flex-col gap-1.5 font-mono text-xs tracking-[0.08em] text-muted">
            FIND A VENDOR OR PRODUCT
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="min-h-11 rounded-[3px] border border-line-strong bg-surface px-3 font-sans text-[15px] tracking-normal text-fg"
            />
          </label>
        </div>
        {shown.length === 0 ? (
          <p className="m-0 text-[15px] text-muted">No tracked event names a vendor or product like that.</p>
        ) : (
          <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))] gap-3 p-0">
            {shown.map((v) => {
              const on = chosen.has(v.key);
              return (
                <li key={v.key} className={`flex min-w-0 flex-col gap-2 rounded border bg-surface p-4 [overflow-wrap:anywhere] ${on ? "border-accent" : "border-line"}`}>
                  <label className="flex min-h-11 cursor-pointer items-center gap-3">
                    <input type="checkbox" checked={on} onChange={() => toggle(v.key)} className="size-5 shrink-0 accent-[var(--color-accent)]" />
                    <span className="font-display text-lg font-semibold leading-snug text-fg">{v.name}</span>
                  </label>
                  <Counts v={v} />
                  <p className="m-0 text-sm leading-normal text-muted">
                    {v.products.join(", ")}
                    {v.more > 0 ? ` and ${v.more} more` : ""}
                  </p>
                  <Link href={`/vendors/${v.key}`} className="self-start py-2 font-mono text-xs tracking-[0.06em]" aria-label={`${v.name}: events and products`}>
                    EVENTS AND PRODUCTS →
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function Counts({ v }: { v: PickerVendor }) {
  return (
    <span className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[13px] tracking-[0.06em]">
      {v.actNow > 0 && <span className={VERDICT_STYLE.act_now.text}>{v.actNow} ACT NOW</span>}
      {v.watch > 0 && <span className={VERDICT_STYLE.watch.text}>{v.watch} WATCH</span>}
      {v.actNow === 0 && v.watch === 0 && <span className="text-muted">{v.total} LOW</span>}
    </span>
  );
}

/** A line for other pages: the reader's saved list when this browser has one, the vendors page when it has none. */
export function MyVendorsLink() {
  const [keys, setKeys] = useState<string[]>([]);
  useEffect(() => {
    queueMicrotask(() => setKeys(readSavedStack()));
  }, []);
  return (
    <p className="m-0 rounded border border-line bg-surface px-5 py-3 text-[15px] leading-normal text-fg-2">
      {keys.length ? `You chose ${keys.length} ${keys.length === 1 ? "vendor" : "vendors"}. ` : "Only want the vendors you use? "}
      <Link href={stackHref(keys)} className="inline-block py-2 font-mono text-[13px] font-bold tracking-[0.06em]">
        {keys.length ? "SEE YOUR VENDORS →" : "CHOOSE YOUR VENDORS →"}
      </Link>
    </p>
  );
}
