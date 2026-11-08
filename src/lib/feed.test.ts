import { describe, expect, it } from "vitest";
import { correctionsFeed, xmlEscape, briefFeed } from "./feed";

const row = (id: number, at: string, text: string, title: string | null = null) => ({
  id,
  at,
  eventId: title ? "e1" : null,
  eventTitle: title,
  eventHref: title ? "/events/e1" : null,
  text,
});

describe("correctionsFeed", () => {
  it("escapes markup in text and titles", () => {
    expect(xmlEscape(`a <b> & "c" 'd'`)).toBe("a &lt;b&gt; &amp; &quot;c&quot; &apos;d&apos;");
    const xml = correctionsFeed([row(2, "2026-10-24T10:00:00Z", "Fixed <script> & more", "PHP & friends")], "https://x.test");
    expect(xml).toContain("<title>Correction: PHP &amp; friends</title>");
    expect(xml).toContain("<description>Fixed &lt;script&gt; &amp; more</description>");
    expect(xml).toContain("https://x.test/corrections#c-2");
  });
  it("keeps the order it is given and handles an empty log", () => {
    const xml = correctionsFeed([row(2, "2026-10-24T10:00:00Z", "newer"), row(1, "2026-10-20T10:00:00Z", "older")], "https://x.test");
    expect(xml.indexOf("newer")).toBeLessThan(xml.indexOf("older"));
    const empty = correctionsFeed([], "https://x.test");
    expect(empty).toContain("</channel>");
    expect(empty).not.toContain("<item>");
  });
});

describe("briefFeed", () => {
  const xml = briefFeed(
    {
      week: "2026-11-02",
      weekOf: "Nov 2, 2026",
      weekLine: "2 flaws need action now. Start at the top.",
      top: [
        { rank: 1, id: "kev-a", title: "Citrix <NetScaler>", doThis: "Patch & check.", tier: "today" },
        { rank: 2, id: "kev-b", title: "Ivanti", doThis: "Patch.", tier: "now" },
      ],
    },
    "https://x.test",
  );
  it("has one item per week with a stable guid and the ranked list", () => {
    expect(xml.match(/<item>/g)).toHaveLength(1);
    expect(xml).toContain('<guid isPermaLink="false">https://x.test/brief#week-2026-11-02</guid>');
    expect(xml).toContain("Week of Nov 2, 2026: do this first");
    expect(xml).toContain("1. Citrix &lt;NetScaler&gt; (Act today). Do this: Patch &amp; check. https://x.test/events/kev-a");
    expect(xml).toContain("2. Ivanti. Do this: Patch.");
    expect(xml).toContain("Mon, 02 Nov 2026 00:00:00 GMT");
  });
});
