import { sha256Hex } from "./http";

const CVE_RE = /CVE-\d{4}-\d{4,}/gi;

export function isCveId(s: string): boolean {
  return /^CVE-\d{4}-\d{4,}$/i.test(s);
}

/** All distinct CVE ids found in text, uppercased. */
export function extractCves(text: string | string[] | undefined | null): string[] {
  if (!text) return [];
  const src = Array.isArray(text) ? text.join(" ") : text;
  return [...new Set((src.match(CVE_RE) ?? []).map((c) => c.toUpperCase()))];
}

export function isoOrUndefined(v: unknown): string | undefined {
  if (typeof v !== "string" || !v) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/** Parse MM/DD/YYYY to ISO date (UTC). */
export function usDateToIso(v: string | undefined): string | undefined {
  const m = v?.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return undefined;
  const d = new Date(Date.UTC(Number(m[3]), Number(m[1]) - 1, Number(m[2])));
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/** Run fn over items with limited concurrency, keeping result order. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

/** Hash of a CVE set, used in cursors so a new tracked CVE triggers a re-scan of cached files. */
export function setHash(items: string[]): string {
  return sha256Hex([...items].sort().join(",")).slice(0, 12);
}

/**
 * Pick a batch from a newest-first list: the first `head` items every run, plus a rotating slice
 * of the rest so older items get refreshed over time. Returns the batch and the next offset.
 */
export function pickBatch<T>(list: T[], offset: number, head: number, rotating: number): { batch: T[]; nextOffset: number } {
  const first = list.slice(0, head);
  const rest = list.slice(head);
  if (rest.length === 0 || rotating <= 0) return { batch: first, nextOffset: 0 };
  const start = offset % rest.length;
  const slice: T[] = [];
  for (let i = 0; i < Math.min(rotating, rest.length); i++) slice.push(rest[(start + i) % rest.length]);
  return { batch: [...first, ...slice], nextOffset: (start + slice.length) % rest.length };
}

export function stripHtml(s: string): string {
  return s
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1).trimEnd() + "...";
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Minimal RFC 4180 CSV parser. Returns rows of fields. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** CSV with a header row to array of objects. */
export function parseCsvObjects(text: string): Record<string, string>[] {
  const [head, ...rows] = parseCsv(text);
  if (!head) return [];
  const keys = head.map((h) => h.trim());
  return rows.map((r) => Object.fromEntries(keys.map((k, i) => [k, r[i] ?? ""])));
}

/** Newest first by CVE year then number. */
export function sortCvesNewest(cves: string[]): string[] {
  const key = (c: string) => {
    const m = c.match(/CVE-(\d{4})-(\d+)/);
    return m ? Number(m[1]) * 1e8 + Number(m[2]) : 0;
  };
  return [...cves].sort((a, b) => key(b) - key(a));
}

/** Cursor for big cached files: `etag|trackedHash`. */
export function packFileCursor(etag: string | undefined, tracked: string[]): string {
  return `${etag ?? ""}|${setHash(tracked)}`;
}

export function fileCursorUnchanged(cursor: string | undefined, etag: string | undefined, tracked: string[]): boolean {
  return !!cursor && !!etag && cursor === packFileCursor(etag, tracked);
}

export function cursorEtag(cursor: string | undefined): string | undefined {
  const e = cursor?.split("|")[0];
  return e || undefined;
}
