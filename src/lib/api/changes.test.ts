import { describe, expect, it } from "vitest";
import { changeHeadline, changeKind, changesFeed, ladderDiff, parseChangesSince, type ApiChange } from "./changes";

const base: ApiChange = {
  id: 7,
  eventId: "kev-1",
  url: "https://example.test/events/kev-1",
  title: "Vendor X & Y",
  at: "2026-11-08T10:00:00.000Z",
  kind: "verdict",
  verdict: "act_now",
  previousVerdict: "watch",
  ladder: { talk: "confirmed", exposure: "none", attempts: "confirmed", exploited: "confirmed", damage: "none" },
  previousLadder: { talk: "confirmed", exposure: "none", attempts: "reported", exploited: "none", damage: "none" },
  rulesVersion: "v2",
  reason: "Attacks are confirmed.",
};

describe("change kinds", () => {
  it("names a first row new, a moved verdict verdict, an admin row admin, the rest ladder", () => {
    expect(changeKind({ actor: "rules", previousVerdict: null, verdict: "watch" })).toBe("new");
    expect(changeKind({ actor: "rules", previousVerdict: "watch", verdict: "act_now" })).toBe("verdict");
    expect(changeKind({ actor: "admin:jess", previousVerdict: "watch", verdict: "watch" })).toBe("admin");
    expect(changeKind({ actor: "rules", previousVerdict: "watch", verdict: "watch" })).toBe("ladder");
  });
  it("writes a plain headline for each kind", () => {
    expect(changeHeadline(base)).toBe("Vendor X & Y: now Act now, was Watch");
    expect(changeHeadline({ ...base, kind: "new", previousVerdict: null })).toBe("New: Vendor X & Y (Act now)");
    expect(changeHeadline({ ...base, kind: "ladder", previousVerdict: "act_now" })).toBe("Vendor X & Y: evidence changed, still Act now");
  });
  it("lists the rungs that moved", () => {
    expect(ladderDiff(base.previousLadder, base.ladder)).toEqual(["attempts reported to confirmed", "exploited none to confirmed"]);
    expect(ladderDiff(null, base.ladder)).toEqual([]);
  });
});

describe("since", () => {
  const now = new Date("2026-11-08T12:00:00Z");
  it("defaults to 7 days and floors at 90", () => {
    expect((parseChangesSince(null, now) as { since: Date }).since.toISOString()).toBe("2026-11-01T12:00:00.000Z");
    expect((parseChangesSince("2020-01-01T00:00:00Z", now) as { since: Date }).since.toISOString()).toBe("2026-08-10T12:00:00.000Z");
    expect(parseChangesSince("yesterday", now)).toEqual({ error: "since must be an ISO 8601 timestamp" });
  });
});

describe("changesFeed", () => {
  it("escapes, links and describes each change", () => {
    const xml = changesFeed([base], "https://example.test");
    expect(xml).toContain("<title>Vendor X &amp; Y: now Act now, was Watch</title>");
    expect(xml).toContain("<link>https://example.test/events/kev-1</link>");
    expect(xml).toContain('<guid isPermaLink="false">stp-change-7</guid>');
    expect(xml).toContain("Ladder: attempts reported to confirmed; exploited none to confirmed.");
    expect(xml).toContain("Rules v2.");
  });
});
