import { describe, expect, it } from "vitest";
import { eventsHref, homeSelection, paginateListed, parsePage, parseVerdictFilter, sortListed, type Listable } from "./listing";

const mk = (id: string, verdict: Listable["verdict"], evidenceAt: number, reports = 3): Listable => ({ id, verdict, evidenceAt, reports });
const many = (prefix: string, verdict: Listable["verdict"], n: number, reports = 3) =>
  Array.from({ length: n }, (_, i) => mk(`${prefix}${i}`, verdict, 1000 + i, reports));

describe("sortListed", () => {
  it("orders by verdict, then newest evidence", () => {
    const out = sortListed([mk("l", "low", 9), mk("w-old", "watch", 1), mk("a", "act_now", 0), mk("w-new", "watch", 5)]);
    expect(out.map((x) => x.id)).toEqual(["a", "w-new", "w-old", "l"]);
  });
});

const DAY = 86_400_000;
const NOW = 10_000;

describe("homeSelection", () => {
  it("leaves out Act now events whose newest evidence is older than 30 days", () => {
    const now = 100 * DAY;
    const out = homeSelection([mk("fresh", "act_now", now - 29 * DAY), mk("edge", "act_now", now - 30 * DAY), mk("old", "act_now", now - 31 * DAY)], now);
    expect(out.map((x) => x.id)).toEqual(["fresh", "edge"]);
  });
  it("judges Act now recency by the exploitation report date when there is one", () => {
    const now = 100 * DAY;
    const old = { ...mk("old-kev", "act_now", now), signalAt: now - 90 * DAY };
    const recent = { ...mk("new-kev", "act_now", now - 90 * DAY), signalAt: now - 2 * DAY };
    expect(homeSelection([old, recent], now).map((x) => x.id)).toEqual(["new-kev"]);
  });
  it("shows every recent Act now event and caps Watch at 12 and Low at 6", () => {
    const out = homeSelection([...many("a", "act_now", 30), ...many("w", "watch", 40), ...many("l", "low", 20)], NOW);
    expect(out.filter((x) => x.verdict === "act_now")).toHaveLength(30);
    expect(out.filter((x) => x.verdict === "watch")).toHaveLength(12);
    expect(out.filter((x) => x.verdict === "low")).toHaveLength(6);
    expect(out[0].verdict).toBe("act_now");
  });
  it("keeps the newest Watch events under the cap", () => {
    const out = homeSelection(many("w", "watch", 20));
    expect(out[0].id).toBe("w19");
    expect(out.at(-1)?.id).toBe("w8");
  });
  it("holds back early Watch events with fewer than 2 reports", () => {
    const out = homeSelection([mk("early-cve-1", "watch", 5, 1), mk("early-cve-2", "watch", 4, 2), mk("kev-x", "watch", 3, 1)]);
    expect(out.map((x) => x.id)).toEqual(["early-cve-2", "kev-x"]);
  });
  it("does not hold back early Act now or Low events", () => {
    const out = homeSelection([mk("early-a", "act_now", 5, 1), mk("early-l", "low", 4, 1)], NOW);
    expect(out).toHaveLength(2);
  });
  it("does not let held back early events use up the Watch cap", () => {
    const out = homeSelection([...many("early-", "watch", 20, 1), ...many("w", "watch", 12)]);
    expect(out).toHaveLength(12);
    expect(out.every((x) => !x.id.startsWith("early-"))).toBe(true);
  });
});

describe("paginateListed", () => {
  const all = [...many("a", "act_now", 3), ...many("w", "watch", 120), ...many("l", "low", 4), mk("early-w", "watch", 1, 1)];
  it("pages 50 at a time and includes early events", () => {
    const p1 = paginateListed(all, "all", 1);
    expect(p1.items).toHaveLength(50);
    expect(p1.pages).toBe(3);
    expect(paginateListed(all, "all", 3).items.map((x) => x.id)).toContain("early-w");
  });
  it("filters by verdict and clamps the page", () => {
    const r = paginateListed(all, "watch", 99);
    expect(r.total).toBe(121);
    expect(r.page).toBe(3);
    expect(r.items.every((x) => x.verdict === "watch")).toBe(true);
    expect(paginateListed(all, "low", 0).page).toBe(1);
  });
  it("returns one empty page for no matches", () => {
    expect(paginateListed([], "all", 1)).toEqual({ items: [], total: 0, page: 1, pages: 1 });
  });
});

describe("query parsing", () => {
  it("accepts only known verdicts and positive pages", () => {
    expect(parseVerdictFilter("act_now")).toBe("act_now");
    expect(parseVerdictFilter("bogus")).toBe("all");
    expect(parseVerdictFilter(undefined)).toBe("all");
    expect(parsePage("3")).toBe(3);
    expect(parsePage("-2")).toBe(1);
    expect(parsePage("abc")).toBe(1);
  });
});

describe("eventsHref", () => {
  it("leaves default values out of the query string", () => {
    expect(eventsHref("all", 1)).toBe("/events");
    expect(eventsHref("watch", 1)).toBe("/events?verdict=watch");
    expect(eventsHref("all", 3)).toBe("/events?page=3");
    expect(eventsHref("low", 2)).toBe("/events?verdict=low&page=2");
  });
});

describe("briefBottomLine", () => {
  it("states the counts plainly", async () => {
    const { briefBottomLine } = await import("./index");
    expect(briefBottomLine({ d7: 8, d30: 33 }, 30)).toBe("CISA confirmed 8 newly exploited flaws in the last 7 days and 33 in the last 30 days. 30 events are rated Act now.");
    expect(briefBottomLine({ d7: 1, d30: 1 }, 1)).toBe("CISA confirmed 1 newly exploited flaw in the last 7 days and 1 in the last 30 days. 1 event is rated Act now.");
  });
});
