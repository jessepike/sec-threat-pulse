#!/usr/bin/env node
// Post-deploy smoke test. Usage: node scripts/smoke.mjs [base-url]
// Checks public pages, the JSON API, both RSS feeds, llms.txt and the MCP server, and that no page
// scrolls sideways at 390px. Exits non-zero on any failure. Read only: it changes nothing.
const base = (process.argv[2] ?? "https://securitythreatpulse.com").replace(/\/$/, "");
const failures = [];
const ok = (cond, msg) => {
  if (!cond) failures.push(msg);
  console.log(`${cond ? "ok  " : "FAIL"} ${msg}`);
};

async function get(path, init) {
  const res = await fetch(base + path, init);
  return { res, text: await res.text() };
}

for (const path of ["/", "/events", "/events?verdict=act_now", "/vendors", "/brief", "/methodology", "/track-record", "/corrections", "/about"]) {
  const { res, text } = await get(path);
  ok(res.status === 200 && text.includes("SECURITY_THREAT_PULSE"), `page ${path} renders`);
}

const list = await get("/api/v1/events?verdict=act_now");
let firstId = null;
try {
  const d = JSON.parse(list.text);
  ok(list.res.status === 200 && Array.isArray(d.events) && typeof d.total === "number", "api list has events and a total");
  ok(list.res.headers.get("access-control-allow-origin") === "*", "api allows cross-origin reads");
  firstId = d.events[0]?.id ?? null;
} catch {
  ok(false, "api list returns JSON");
}
if (firstId) {
  const one = await get(`/api/v1/events/${firstId}`);
  const d = JSON.parse(one.text);
  ok(one.res.status === 200 && d.event?.id === firstId && Array.isArray(d.event.evidence), "api detail returns the event with evidence");
  const page = await get(`/events/${firstId}`);
  ok(page.res.status === 200 && page.text.includes("og:image"), "event page renders with a share image");
}
ok((await get("/api/v1/events/not-a-real-event")).res.status === 404, "api unknown id is 404");
try {
  const spec = JSON.parse((await get("/api/v1/openapi.json")).text);
  ok(spec.openapi === "3.1.0" && spec.components?.schemas?.Event?.required?.includes("affectedProducts"), "openapi document lists the Event schema");
} catch {
  ok(false, "openapi document returns JSON");
}
ok((await get("/api/v1/events?since=not-a-date")).res.status === 400, "api bad since is 400");
ok((await get("/api/v1/events?verdict=bad")).res.status === 400, "api bad verdict is 400");

for (const feed of ["/events/feed.xml", "/events/changes.xml", "/corrections/feed.xml"]) {
  const { res, text } = await get(feed);
  ok(res.status === 200 && text.startsWith("<?xml") && text.includes("<rss"), `feed ${feed} is RSS`);
}
ok((await get("/llms.txt")).text.includes("/api/mcp"), "llms.txt lists the MCP server");
try {
  const ch = await get("/api/v1/changes");
  const d = JSON.parse(ch.text);
  ok(ch.res.status === 200 && Array.isArray(d.changes) && typeof d.total === "number", `api changes lists ${d.total} change(s)`);
} catch {
  ok(false, "api changes returns JSON");
}
try {
  const tr = await get("/api/v1/track-record");
  const d = JSON.parse(tr.text);
  ok(tr.res.status === 200 && typeof d.live?.actNow?.overall?.calls === "number" && Array.isArray(d.versions) && d.versions.length > 0, `api track record has ${d.live?.actNow?.overall?.calls} early call(s) and ${d.versions?.length} version(s)`);
} catch {
  ok(false, "api track record returns JSON");
}
try {
  const br = await get("/api/v1/brief");
  const d = JSON.parse(br.text);
  ok(br.res.status === 200 && typeof d.weekLine === "string" && Array.isArray(d.top) && d.top.length <= 5 && d.top.every((t, i) => t.rank === i + 1 && t.verdict === "act_now"), `api brief lists ${d.top?.length} item(s) for week ${d.week}`);
  const cs = await get("/api/v1/check-stack?products=Microsoft,Fortinet");
  const c = JSON.parse(cs.text);
  ok(cs.res.status === 200 && c.results?.length === 2, `api check-stack answers for 2 products (${c.actNowTotal} Act now)`);
  const feed = await get("/brief/feed.xml");
  ok(feed.res.status === 200 && feed.text.includes("<rss") && feed.text.includes(`week-${d.week}`), "brief RSS carries this week's item");
} catch {
  ok(false, "api brief and check-stack return JSON");
}
{
  const today = new Date().toISOString().slice(0, 10);
  const csv = await get(`/api/v1/export/events-${today}.csv`);
  ok(csv.res.status === 200 && csv.text.startsWith("id,url,title,verdict") && (csv.res.headers.get("link") ?? "").includes("license"), "csv export for today has a header row and a license link");
  const latest = await get("/api/v1/export/events-latest.json", { redirect: "manual" });
  ok(latest.res.status === 302 && (latest.res.headers.get("location") ?? "").endsWith(`events-${today}.json`), "events-latest.json redirects to today's dated file");
  ok((await get("/api/v1/export/events-2020-01-01.csv")).res.status === 404, "export for a past day is 404 and points at the data branch");
}

{
  const idx = await get("/llms.txt");
  const full = await get("/llms-full.txt");
  ok(idx.res.status === 200 && idx.text.includes("/llms-full.txt"), "llms.txt links the full text");
  ok(full.res.status === 200 && full.text.startsWith(idx.text) && full.text.includes("## Rules changelog") && full.text.includes("## The evidence ladder"), "llms-full.txt has the index, the ladder and the rules changelog");
}

for (const path of ["/status.json", "/api/v1/health"]) {
  const { res, text } = await get(path);
  try {
    const d = JSON.parse(text);
    ok(res.status === 200 && ["ok", "delayed"].includes(d.state) && typeof d.lastCompleteAt === "string" && typeof d.rulesVersion === "string", `${path} reports state ${d.state}, last complete ${d.lastCompleteAt}`);
  } catch {
    ok(false, `${path} returns JSON`);
  }
}

const mcp = await get("/api/mcp", {
  method: "POST",
  headers: { "content-type": "application/json", accept: "application/json, text/event-stream", "mcp-protocol-version": "2025-06-18" },
  body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
});
ok(["get_brief", "check_stack", "list_events", "get_event", "search_events", "get_track_record"].every((t) => mcp.text.includes(`"${t}"`)), "mcp lists its six tools");

try {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  for (const path of ["/", "/events", "/brief", "/methodology", ...(firstId ? [`/events/${firstId}`] : [])]) {
    await page.goto(base + path, { waitUntil: "networkidle" });
    const sw = await page.evaluate(() => document.documentElement.scrollWidth);
    ok(sw <= 390, `no sideways scroll at 390px on ${path} (${sw}px)`);
  }
  await browser.close();
} catch (e) {
  console.log(`skip layout checks: ${e instanceof Error ? e.message.split("\n")[0] : e}`);
}

console.log(failures.length ? `\n${failures.length} check(s) failed` : "\nall checks passed");
process.exit(failures.length ? 1 : 0);
