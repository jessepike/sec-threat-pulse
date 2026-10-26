import type { CorrectionView } from "@/lib/data/types";
import { SITE_NAME, SITE_URL } from "./site";

export function xmlEscape(s: string): string {
  // Characters that XML 1.0 forbids are dropped, then the five markup characters are escaped.
  return s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

export function correctionTitle(c: CorrectionView): string {
  return c.eventTitle ? `Correction: ${c.eventTitle}` : "Correction";
}

/** RSS 2.0 feed of the corrections log. Rows must already be newest first. */
export function correctionsFeed(rows: CorrectionView[], site: string = SITE_URL): string {
  const items = rows.map((c) => {
    const link = `${site}/corrections#c-${c.id}`;
    return [
      "    <item>",
      `      <title>${xmlEscape(correctionTitle(c))}</title>`,
      `      <link>${xmlEscape(link)}</link>`,
      `      <guid isPermaLink="true">${xmlEscape(link)}</guid>`,
      `      <pubDate>${new Date(c.at).toUTCString()}</pubDate>`,
      `      <description>${xmlEscape(c.text)}</description>`,
      "    </item>",
    ].join("\n");
  });
  const built = rows.length ? new Date(rows[0].at).toUTCString() : new Date(0).toUTCString();
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "  <channel>",
    `    <title>${xmlEscape(`${SITE_NAME} corrections`)}</title>`,
    `    <link>${site}/corrections</link>`,
    `    <atom:link href="${site}/corrections/feed.xml" rel="self" type="application/rss+xml" />`,
    "    <description>Every correction to a verdict, ladder or published text, newest first.</description>",
    "    <language>en-us</language>",
    `    <lastBuildDate>${built}</lastBuildDate>`,
    ...items,
    "  </channel>",
    "</rss>",
    "",
  ].join("\n");
}

export interface FeedEvent {
  id: string;
  title: string;
  summary: string | null;
  verdictReason: string | null;
  updatedAt: string;
}

/** RSS 2.0 feed of Act now events, newest evidence first. */
export function actNowFeed(events: FeedEvent[], site: string = SITE_URL): string {
  const items = events.map((e) => {
    const link = `${site}/events/${e.id}`;
    const text = [e.summary, e.verdictReason ? `Why Act now: ${e.verdictReason}` : null].filter(Boolean).join(" ");
    return [
      "    <item>",
      `      <title>${xmlEscape(e.title)}</title>`,
      `      <link>${xmlEscape(link)}</link>`,
      `      <guid isPermaLink="false">${xmlEscape(`${e.id}@${e.updatedAt}`)}</guid>`,
      `      <pubDate>${new Date(e.updatedAt).toUTCString()}</pubDate>`,
      `      <description>${xmlEscape(text)}</description>`,
      "    </item>",
    ].join("\n");
  });
  const built = events.length ? new Date(events[0].updatedAt).toUTCString() : new Date(0).toUTCString();
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "  <channel>",
    `    <title>${xmlEscape(`${SITE_NAME}: Act now`)}</title>`,
    `    <link>${site}/events?verdict=act_now</link>`,
    `    <atom:link href="${site}/events/feed.xml" rel="self" type="application/rss+xml" />`,
    "    <description>Events rated Act now by the published rules, newest evidence first. Not advice.</description>",
    "    <language>en-us</language>",
    `    <lastBuildDate>${built}</lastBuildDate>`,
    ...items,
    "  </channel>",
    "</rss>",
    "",
  ].join("\n");
}
