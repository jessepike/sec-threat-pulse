import { XMLParser } from "fast-xml-parser";
import type { AdapterResult, ObservationInput, SourceAdapter } from "@/lib/ladder/types";
import { httpGet, sha256Hex } from "../http";
import { isoOrUndefined, stripHtml, truncate } from "../util";

/**
 * Generic RSS 2.0, Atom and RDF (RSS 1.0) adapter factory for Talk (news) and advisory (government)
 * feeds. No article text is stored: only the headline, the canonical link, the publish time and the
 * CVE ids the item mentions. Items with no CVE are counted and skipped (Phase 3 grouping uses them).
 */

export type FeedKind = "talk" | "advisory";

export interface FeedConfig {
  /** Source id, one per feed so the ladder can count independent sources (e.g. `news-thehackernews`). */
  id: string;
  name: string;
  url: string;
  kind: FeedKind;
  intervalMinutes?: number;
}

export interface FeedItem {
  title: string;
  url: string;
  publishedAt?: string;
  /** Text scanned for CVE ids and exploitation phrases. Never stored. */
  text: string;
}

export interface ParsedFeed {
  items: FeedItem[];
  format: "rss" | "atom" | "rdf" | "unknown";
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  isArray: (name) => ["item", "entry", "link", "category"].includes(name),
});

/** CVE-YYYY-NNNN+ as a whole token. "CVE-2026-1" (too short) and "XCVE-2026-1234" do not match. */
const FEED_CVE_RE = /(?<![A-Za-z0-9])CVE-(\d{4})-(\d{4,})(?!\d)/gi;

/** Distinct CVE ids in the given strings, uppercased, with a plausible year. */
export function extractFeedCves(parts: (string | undefined | null)[], now: Date = new Date()): string[] {
  const maxYear = now.getUTCFullYear() + 1;
  const out = new Set<string>();
  for (const part of parts) {
    if (!part) continue;
    for (const m of part.matchAll(FEED_CVE_RE)) {
      const year = Number(m[1]);
      if (year < 1999 || year > maxYear) continue;
      out.add(`CVE-${m[1]}-${m[2]}`);
    }
  }
  return [...out];
}

const EXPLOIT_PHRASE_RE = /\b(actively exploited|exploited in the wild|under active exploitation)\b/i;

/** True when the text uses a plain exploitation phrase. Stored as metadata only; it does not move the ladder. */
export function hasExploitPhrase(text: string): boolean {
  return EXPLOIT_PHRASE_RE.test(text.replace(/\s+/g, " "));
}

type Node = unknown;

/** Some feeds double-encode, leaving entities like &#x5b; in titles after XML decoding. */
function decodeNumericEntities(s: string): string {
  return s.replace(/&#(x[0-9a-f]+|\d+);/gi, (m, c: string) => {
    const code = c[0].toLowerCase() === "x" ? parseInt(c.slice(1), 16) : parseInt(c, 10);
    return code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
  });
}

/** Text of an XML node: a string, or an object with #text. */
function textOf(n: Node): string {
  if (n == null) return "";
  if (typeof n === "string") return n;
  if (typeof n === "number" || typeof n === "boolean") return String(n);
  if (Array.isArray(n)) return n.map(textOf).join(" ");
  if (typeof n === "object") {
    const o = n as Record<string, unknown>;
    return textOf(o["#text"]);
  }
  return "";
}

function first<T>(v: T | T[] | undefined): T | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/** Canonical link: trimmed, no fragment, no tracking parameters. Returns "" when not an http(s) URL. */
export function canonicalUrl(raw: string): string {
  const s = raw.trim();
  if (!/^https?:\/\//i.test(s)) return "";
  try {
    const u = new URL(s);
    u.hash = "";
    for (const k of [...u.searchParams.keys()]) {
      if (/^(utm_|fbclid$|gclid$|mc_|oly_|__s$|_hs)/i.test(k)) u.searchParams.delete(k);
    }
    return u.toString();
  } catch {
    return "";
  }
}

function itemLink(it: Record<string, unknown>): string {
  const links = (it.link as unknown[] | undefined) ?? [];
  // Atom: <link rel="alternate" href="..."/>. RSS: <link>url</link>.
  let fallback = "";
  for (const l of links) {
    if (typeof l === "string") {
      const c = canonicalUrl(l);
      if (c) return c;
    } else if (l && typeof l === "object") {
      const o = l as Record<string, unknown>;
      const href = typeof o["@_href"] === "string" ? o["@_href"] : textOf(o);
      const rel = o["@_rel"];
      const c = canonicalUrl(href);
      if (!c) continue;
      if (rel == null || rel === "alternate") return c;
      if (!fallback) fallback = c;
    }
  }
  if (fallback) return fallback;
  // RDF items sometimes carry the URL in rdf:about; RSS in a permalink guid.
  const about = it["@_rdf:about"];
  if (typeof about === "string" && canonicalUrl(about)) return canonicalUrl(about);
  const guid = it.guid;
  const g = textOf(guid);
  if (canonicalUrl(g)) return canonicalUrl(g);
  return canonicalUrl(textOf(it.id));
}

/** Parse RSS 2.0, Atom or RDF into plain items. Throws when the XML is not a feed. */
export function parseFeed(xml: string): ParsedFeed {
  const doc = parser.parse(xml) as Record<string, unknown>;
  let format: ParsedFeed["format"] = "unknown";
  let raw: Record<string, unknown>[] = [];
  const rss = doc.rss as Record<string, unknown> | undefined;
  const atom = doc.feed as Record<string, unknown> | undefined;
  const rdf = doc["rdf:RDF"] as Record<string, unknown> | undefined;
  if (rss) {
    format = "rss";
    const ch = first(rss.channel as Record<string, unknown> | Record<string, unknown>[] | undefined);
    raw = ((ch?.item as Record<string, unknown>[] | undefined) ?? []) as Record<string, unknown>[];
  } else if (atom) {
    format = "atom";
    raw = (atom.entry as Record<string, unknown>[] | undefined) ?? [];
  } else if (rdf) {
    format = "rdf";
    raw = (rdf.item as Record<string, unknown>[] | undefined) ?? [];
  } else {
    throw new Error("Not an RSS, Atom or RDF feed");
  }

  const items: FeedItem[] = [];
  for (const it of raw) {
    if (!it || typeof it !== "object") continue;
    const title = decodeNumericEntities(stripHtml(textOf(it.title)));
    const url = itemLink(it);
    const categories = ((it.category as unknown[] | undefined) ?? []).map((c) =>
      typeof c === "object" && c ? textOf((c as Record<string, unknown>)["@_term"] ?? c) : textOf(c),
    );
    const text = [
      title,
      textOf(it.description),
      textOf(it.summary),
      textOf(it["content:encoded"]),
      textOf(it.content),
      ...categories,
      url,
    ].join(" ");
    const dateRaw = textOf(it.pubDate) || textOf(it["dc:date"]) || textOf(it.published) || textOf(it.updated);
    items.push({ title, url, publishedAt: isoOrUndefined(dateRaw), text });
  }
  return { items, format };
}

export interface FeedObservations {
  observations: ObservationInput[];
  stats: { items: number; withCve: number; withoutCve: number; exploitPhrase: number; noLink: number };
  format: ParsedFeed["format"];
}

/** Turn a feed document into observations. Pure: no network. */
export function feedToObservations(cfg: FeedConfig, xml: string, now: Date = new Date()): FeedObservations {
  const parsed = parseFeed(xml);
  const stats = { items: parsed.items.length, withCve: 0, withoutCve: 0, exploitPhrase: 0, noLink: 0 };
  const observations: ObservationInput[] = [];
  const seen = new Set<string>();
  for (const it of parsed.items) {
    if (!it.url || !it.title) {
      stats.noLink++;
      continue;
    }
    const cveIds = extractFeedCves([it.text], now);
    if (cveIds.length === 0) {
      stats.withoutCve++;
      continue;
    }
    const dedupeKey = `${cfg.id}:${sha256Hex(it.url)}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    stats.withCve++;
    const exploitPhrase = hasExploitPhrase(it.text);
    if (exploitPhrase) stats.exploitPhrase++;
    observations.push({
      sourceId: cfg.id,
      dedupeKey,
      kind: cfg.kind,
      strength: "reported",
      cveIds,
      title: truncate(it.title, 300),
      url: it.url,
      publishedAt: it.publishedAt,
      metadata: {
        feedFormat: parsed.format,
        exploitPhrase,
      },
    });
  }
  return { observations, stats, format: parsed.format };
}

interface FeedCursor {
  e?: string;
  m?: string;
}

function readCursor(c: string | undefined): FeedCursor {
  if (!c) return {};
  try {
    const o = JSON.parse(c) as FeedCursor;
    return o && typeof o === "object" ? o : {};
  } catch {
    return {};
  }
}

export function makeFeedAdapter(cfg: FeedConfig): SourceAdapter {
  return {
    id: cfg.id,
    name: cfg.name,
    intervalMinutes: cfg.intervalMinutes ?? (cfg.kind === "advisory" ? 60 : 30),
    async run(ctx): Promise<AdapterResult> {
      const cur = readCursor(ctx.cursor);
      const res = await httpGet(ctx.fetch, cfg.url, {
        etag: cur.e,
        lastModified: cur.m,
        sleep: ctx.sleep,
        headers: { Accept: "application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.9, */*;q=0.5" },
      });
      if (res.notModified) {
        return { observations: [], vulnerabilities: [], cursor: ctx.cursor, stats: { notModified: 1 } };
      }
      const out = feedToObservations(cfg, res.body, ctx.now);
      const next: FeedCursor = { e: res.etag, m: res.lastModified };
      return {
        observations: out.observations,
        vulnerabilities: [],
        cursor: next.e || next.m ? JSON.stringify(next) : undefined,
        stats: out.stats,
      };
    },
  };
}

/** Feed list: one source id per feed. */
export const NEWS_FEEDS: FeedConfig[] = [
  { id: "news-thehackernews", name: "The Hacker News", url: "https://feeds.feedburner.com/TheHackersNews", kind: "talk" },
  { id: "news-bleepingcomputer", name: "BleepingComputer", url: "https://www.bleepingcomputer.com/feed/", kind: "talk" },
  { id: "news-securityweek", name: "SecurityWeek", url: "https://www.securityweek.com/feed/", kind: "talk" },
  { id: "news-therecord", name: "The Record", url: "https://therecord.media/feed", kind: "talk" },
  { id: "news-darkreading", name: "Dark Reading", url: "https://www.darkreading.com/rss.xml", kind: "talk" },
  { id: "news-krebs", name: "Krebs on Security", url: "https://krebsonsecurity.com/feed/", kind: "talk" },
  { id: "news-helpnetsecurity", name: "Help Net Security", url: "https://www.helpnetsecurity.com/feed/", kind: "talk" },
  { id: "news-cyberscoop", name: "CyberScoop", url: "https://cyberscoop.com/feed/", kind: "talk" },
  { id: "news-theregister", name: "The Register (security)", url: "https://www.theregister.com/security/headlines.atom", kind: "talk" },
  { id: "news-securityaffairs", name: "Security Affairs", url: "https://securityaffairs.com/feed", kind: "talk" },
  { id: "news-cybersecuritydive", name: "Cybersecurity Dive", url: "https://www.cybersecuritydive.com/feeds/news/", kind: "talk" },
  { id: "news-sansisc", name: "SANS Internet Storm Center", url: "https://isc.sans.edu/rssfeed_full.xml", kind: "talk" },
];

export const ADVISORY_FEEDS: FeedConfig[] = [
  { id: "advisory-ncsc-uk", name: "UK NCSC", url: "https://www.ncsc.gov.uk/api/1/services/v1/all-rss-feed.xml", kind: "advisory" },
  { id: "advisory-cert-eu", name: "CERT-EU", url: "https://cert.europa.eu/publications/security-advisories-rss", kind: "advisory" },
  { id: "advisory-cccs", name: "Canadian Centre for Cyber Security", url: "https://www.cyber.gc.ca/api/cccs/rss/v1/get?feed=alerts_advisories&lang=en", kind: "advisory" },
];

export const FEED_HOMEPAGES: Record<string, string> = {
  "news-thehackernews": "https://thehackernews.com/",
  "news-bleepingcomputer": "https://www.bleepingcomputer.com/",
  "news-securityweek": "https://www.securityweek.com/",
  "news-therecord": "https://therecord.media/",
  "news-darkreading": "https://www.darkreading.com/",
  "news-krebs": "https://krebsonsecurity.com/",
  "news-helpnetsecurity": "https://www.helpnetsecurity.com/",
  "news-cyberscoop": "https://cyberscoop.com/",
  "news-theregister": "https://www.theregister.com/security/",
  "news-securityaffairs": "https://securityaffairs.com/",
  "news-cybersecuritydive": "https://www.cybersecuritydive.com/",
  "news-sansisc": "https://isc.sans.edu/",
  "advisory-ncsc-uk": "https://www.ncsc.gov.uk/",
  "advisory-cert-eu": "https://cert.europa.eu/publications/security-advisories/",
  "advisory-cccs": "https://www.cyber.gc.ca/en/alerts-advisories",
};
