import { describe, expect, it } from "vitest";
import { correctionsFeed, xmlEscape } from "./feed";

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
