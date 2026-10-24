import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { fakeFetch, noSleep } from "./testing";
import {
  ADVISORY_FEEDS,
  NEWS_FEEDS,
  canonicalUrl,
  extractFeedCves,
  feedToObservations,
  hasExploitPhrase,
  makeFeedAdapter,
  parseFeed,
} from "./adapters/feeds";
import { SOURCE_REGISTRY } from "./registry";
import { sha256Hex } from "./http";

const dir = path.join(__dirname, "__fixtures__", "feeds");
const load = (n: string) => readFileSync(path.join(dir, n), "utf8");
const now = new Date("2026-10-24T18:00:00Z");
const cfg = { id: "news-test", name: "Test", url: "https://example.org/feed", kind: "talk" as const };

describe("feed formats", () => {
  it("parses RSS 2.0", () => {
    const p = parseFeed(load("thehackernews.xml"));
    expect(p.format).toBe("rss");
    expect(p.items.length).toBeGreaterThan(0);
    expect(p.items[0].url).toMatch(/^https:/);
  });
  it("parses Atom (real CCCS sample)", () => {
    const p = parseFeed(load("cccs.xml"));
    expect(p.format).toBe("atom");
    expect(p.items.length).toBe(3);
    expect(p.items.every((i) => i.url.startsWith("http") && i.title)).toBe(true);
  });
  it("parses Atom with alternate link, html title and content", () => {
    const p = parseFeed(load("atom-synthetic.xml"));
    expect(p.items[0].url).toBe("https://example.org/posts/cve-2026-30002-patch");
    expect(p.items[0].title).toBe("Patch now: two bugs");
    expect(p.items[0].publishedAt).toBe("2026-10-21T08:00:00.000Z");
  });
  it("parses RDF and strips tracking parameters and fragments", () => {
    const p = parseFeed(load("rdf-synthetic.xml"));
    expect(p.format).toBe("rdf");
    expect(p.items).toHaveLength(2);
    expect(p.items[0].url).toBe("https://example.org/a");
  });
  it("trims whitespace in link text (CERT-EU)", () => {
    for (const i of parseFeed(load("certeu.xml")).items) expect(i.url).toBe(i.url.trim());
  });
  it("rejects non-feed XML", () => {
    expect(() => parseFeed("<html><body>hi</body></html>")).toThrow();
  });
  it("yields observations for every recorded fixture without throwing", () => {
    for (const f of readdirSync(dir)) {
      const out = feedToObservations(cfg, load(f), now);
      expect(out.stats.items).toBeGreaterThan(0);
      expect(out.stats.withCve + out.stats.withoutCve + out.stats.noLink).toBeGreaterThanOrEqual(out.observations.length);
      for (const o of out.observations) {
        expect(o.cveIds.length).toBeGreaterThan(0);
        expect(o.summary).toBeUndefined();
      }
    }
  });
});

describe("CVE extraction", () => {
  it("normalizes case, dedupes, and reads URLs", () => {
    expect(extractFeedCves(["cve-2026-1234 and CVE-2026-1234", "https://x.org/cve-2026-9999-fix"], now)).toEqual(["CVE-2026-1234", "CVE-2026-9999"]);
  });
  it("rejects too-short numbers, embedded tokens and implausible years", () => {
    expect(extractFeedCves(["CVE-2026-1", "CVE-2026-123", "XCVE-2026-1234", "CVE-1850-1234", "CVE-2099-1234"], now)).toEqual([]);
  });
  it("accepts long sequence numbers and punctuation neighbours", () => {
    expect(extractFeedCves(["(CVE-2026-1234567), CVE-2026-20001."], now)).toEqual(["CVE-2026-1234567", "CVE-2026-20001"]);
  });
  it("does not split a longer digit run", () => {
    expect(extractFeedCves(["CVE-2026-12345678901234"], now)).toEqual(["CVE-2026-12345678901234"]);
  });
});

describe("observations", () => {
  it("emits one observation per CVE item with headline, link and no summary", () => {
    const out = feedToObservations(cfg, load("atom-synthetic.xml"), now);
    expect(out.stats).toMatchObject({ items: 2, withCve: 1, withoutCve: 1 });
    const o = out.observations[0];
    expect(o).toMatchObject({
      sourceId: "news-test",
      kind: "talk",
      strength: "reported",
      title: "Patch now: two bugs",
      url: "https://example.org/posts/cve-2026-30002-patch",
    });
    expect(o.cveIds.sort()).toEqual(["CVE-2026-30001", "CVE-2026-30002", "CVE-2026-30003"]);
    expect(o.summary).toBeUndefined();
    expect(o.dedupeKey).toBe(`news-test:${sha256Hex(o.url)}`);
  });
  it("flags exploitation phrases in metadata only", () => {
    const out = feedToObservations(cfg, load("rdf-synthetic.xml"), now);
    expect(out.observations).toHaveLength(1);
    expect(out.observations[0].metadata?.exploitPhrase).toBe(true);
    expect(out.observations[0].kind).toBe("talk");
    expect(hasExploitPhrase("Bug is Actively  Exploited")).toBe(true);
    expect(hasExploitPhrase("exploited in the wild")).toBe(true);
    expect(hasExploitPhrase("under active exploitation")).toBe(true);
    expect(hasExploitPhrase("could be exploited")).toBe(false);
  });
  it("dedupes repeated items within a feed", () => {
    const xml = `<rss version="2.0"><channel>${"<item><title>CVE-2026-5555 bug</title><link>https://e.org/1?utm_medium=x</link></item>".repeat(3)}</channel></rss>`;
    const out = feedToObservations(cfg, xml, now);
    expect(out.observations).toHaveLength(1);
  });
  it("skips items with no link", () => {
    const xml = `<rss version="2.0"><channel><item><title>CVE-2026-5555 bug</title></item></channel></rss>`;
    expect(feedToObservations(cfg, xml, now).stats.noLink).toBe(1);
  });
  it("canonicalUrl drops non-http links", () => {
    expect(canonicalUrl("javascript:alert(1)")).toBe("");
    expect(canonicalUrl(" https://e.org/p?id=1&utm_source=a ")).toBe("https://e.org/p?id=1");
  });
});

describe("adapter", () => {
  it("uses advisory kind and 60 minutes for government feeds, 30 for news", () => {
    expect(NEWS_FEEDS.every((f) => makeFeedAdapter(f).intervalMinutes === 30 && f.kind === "talk")).toBe(true);
    expect(ADVISORY_FEEDS.every((f) => makeFeedAdapter(f).intervalMinutes === 60 && f.kind === "advisory")).toBe(true);
  });
  it("gives every feed its own source id and registers it", () => {
    const ids = [...NEWS_FEEDS, ...ADVISORY_FEEDS].map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(15);
    const reg = SOURCE_REGISTRY.map((d) => d.adapter.id);
    for (const id of ids) expect(reg).toContain(id);
  });
  it("runs, stores etag and last-modified, and honours 304", async () => {
    const f = fakeFetch([["example.org/feed", { body: load("atom-synthetic.xml"), headers: { etag: '"abc"', "last-modified": "Fri, 23 Oct 2026 10:00:00 GMT" } }]]);
    const a = makeFeedAdapter(cfg);
    const r = await a.run({ fetch: f.fetch, now, sleep: noSleep });
    expect(r.observations).toHaveLength(1);
    expect(r.stats).toMatchObject({ withoutCve: 1 });
    expect(r.raw).toBeUndefined();
    expect(JSON.parse(r.cursor!)).toEqual({ e: '"abc"', m: "Fri, 23 Oct 2026 10:00:00 GMT" });
    expect(f.calls[0].headers["User-Agent"]).toContain("SecurityThreatPulse");

    const f2 = fakeFetch([["example.org/feed", { status: 304 }]]);
    const r2 = await a.run({ fetch: f2.fetch, now, sleep: noSleep, cursor: r.cursor });
    expect(r2.observations).toHaveLength(0);
    expect(r2.cursor).toBe(r.cursor);
    expect(f2.calls[0].headers["If-None-Match"]).toBe('"abc"');
    expect(f2.calls[0].headers["If-Modified-Since"]).toBe("Fri, 23 Oct 2026 10:00:00 GMT");
  });
  it("re-running yields identical dedupe keys", async () => {
    const f = fakeFetch([["example.org/feed", load("atom-synthetic.xml")]]);
    const a = makeFeedAdapter(cfg);
    const r1 = await a.run({ fetch: f.fetch, now, sleep: noSleep });
    const r2 = await a.run({ fetch: f.fetch, now, sleep: noSleep });
    expect(r1.observations.map((o) => o.dedupeKey)).toEqual(r2.observations.map((o) => o.dedupeKey));
  });
});

describe("titles", () => {
  it("decodes double-encoded numeric entities", () => {
    const xml = `<rss version="2.0"><channel><item><title>PHP bug CVE-2026-5555 &amp;#x5b;update&amp;#93;</title><link>https://e.org/1</link></item></channel></rss>`;
    expect(feedToObservations(cfg, xml, now).observations[0].title).toBe("PHP bug CVE-2026-5555 [update]");
  });
});
