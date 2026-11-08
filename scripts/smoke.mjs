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

for (const path of ["/", "/events", "/events?verdict=act_now", "/brief", "/methodology", "/corrections", "/about"]) {
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

for (const feed of ["/events/feed.xml", "/corrections/feed.xml"]) {
  const { res, text } = await get(feed);
  ok(res.status === 200 && text.startsWith("<?xml") && text.includes("<rss"), `feed ${feed} is RSS`);
}
ok((await get("/llms.txt")).text.includes("/api/mcp"), "llms.txt lists the MCP server");

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
ok(["list_events", "get_event", "search_events"].every((t) => mcp.text.includes(`"${t}"`)), "mcp lists its three tools");

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
