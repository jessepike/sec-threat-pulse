#!/usr/bin/env node
// The agent test set: 31 questions an AI agent asks the live site through its public machine
// interfaces (JSON API, OpenAPI, MCP server, feeds, llms.txt, health), each with a mechanical pass
// or fail. Runs nightly from GitHub Actions and keeps one open issue labeled `alert` while any
// question fails. Read only: it changes nothing on the site.
//
// Usage: node scripts/agent-tests.mjs [base-url] [--json]
// Env: GITHUB_TOKEN (issues: write) and GITHUB_REPOSITORY to sync the alert issue; without them the
// script only prints and exits non-zero on failure.
const args = process.argv.slice(2);
const base = (args.find((a) => !a.startsWith("--")) ?? "https://securitythreatpulse.com").replace(/\/$/, "");
const asJson = args.includes("--json");
const repo = process.env.GITHUB_REPOSITORY ?? "jessepike/sec-threat-pulse";
const token = process.env.GITHUB_TOKEN;
const LABEL = "alert";
const TITLE_PREFIX = "[alert] Agent test set:";
const UA = "SecurityThreatPulse/0.1 (+https://securitythreatpulse.com; jp@jessepike.dev)";
const DAY = 86_400_000;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const CVE_RE = /^CVE-\d{4}-\d{4,}$/;
const RUNGS = ["talk", "exposure", "attempts", "exploited", "damage"];
const STATES = ["confirmed", "reported", "none"];

async function get(path, init = {}) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 25_000);
  try {
    const res = await fetch(base + path, { ...init, headers: { "user-agent": UA, accept: "application/json, text/event-stream, */*", ...(init.headers ?? {}) }, cache: "no-store", signal: controller.signal });
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
    return { status: res.status, headers: res.headers, text, json };
  } catch (e) {
    return { status: 0, headers: new Headers(), text: "", json: null, error: e instanceof Error ? e.message : String(e) };
  } finally {
    clearTimeout(t);
  }
}

/** One MCP JSON-RPC call. mcp-handler answers JSON or an SSE stream depending on the client; accept both. */
async function mcp(method, params, id = 1) {
  const r = await get("/api/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", "mcp-protocol-version": "2025-06-18" },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
  });
  if (r.json) return r.json;
  const data = r.text.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trim()).filter(Boolean);
  for (const d of data) {
    try {
      const j = JSON.parse(d);
      if (j.id === id) return j;
    } catch {
      /* keep looking */
    }
  }
  return { error: { message: `no JSON-RPC answer (HTTP ${r.status})` } };
}
const mcpResult = (rpc) => {
  const text = rpc?.result?.content?.find((c) => c.type === "text")?.text;
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const isSummary = (e) =>
  e &&
  typeof e.id === "string" &&
  typeof e.title === "string" &&
  ["act_now", "watch", "low"].includes(e.verdict) &&
  typeof e.url === "string" &&
  e.url.startsWith(base + "/events/") &&
  Array.isArray(e.cves) &&
  Array.isArray(e.affectedProducts) &&
  e.category &&
  typeof e.category.id === "string" &&
  typeof e.rulesVersion === "string" &&
  ISO_RE.test(e.firstSeenAt) &&
  ISO_RE.test(e.updatedAt) &&
  ISO_RE.test(e.newestEvidenceAt);
const ladderOk = (l) => l && typeof l === "object" && RUNGS.every((r) => STATES.includes(l[r]));
const ladderConsistent = (l) => {
  // The one entailment the ladder implements: exploitation lifts attempts to at least its state.
  // Exposure (public exploit code) and damage are measured on their own.
  const rank = { none: 0, reported: 1, confirmed: 2 };
  return rank[l.attempts] >= rank[l.exploited];
};

const results = [];
const run = async (n, question, fn) => {
  const started = Date.now();
  try {
    const out = await fn();
    const pass = out === true || (out && out.pass === true);
    results.push({ n, question, pass, detail: out && out.detail ? out.detail : pass ? "" : String(out?.detail ?? out ?? "failed"), ms: Date.now() - started });
  } catch (e) {
    results.push({ n, question, pass: false, detail: e instanceof Error ? e.message : String(e), ms: Date.now() - started });
  }
  const r = results[results.length - 1];
  if (!asJson) console.log(`${r.pass ? "ok  " : "FAIL"} ${String(n).padStart(2)}. ${question}${r.detail ? ` (${r.detail})` : ""}`);
};

// Shared fetches, made once.
const list = await get("/api/v1/events");
const actNow = await get("/api/v1/events?verdict=act_now");
const events = list.json?.events ?? [];
const first = actNow.json?.events?.[0] ?? events[0] ?? null;
const detail = first ? await get(`/api/v1/events/${first.id}`) : null;
const ev = detail?.json?.event ?? null;
const spec = await get("/api/v1/openapi.json");
const health = await get("/api/v1/health");

// Discovery
await run(1, "Is the site up, and when did it last complete a run?", () => ({
  pass: health.status === 200 && ["ok", "delayed"].includes(health.json?.state) && ISO_RE.test(health.json?.lastCompleteAt ?? ""),
  detail: `HTTP ${health.status}${health.error ? ` (${health.error})` : ""}, state ${health.json?.state ?? "?"}, last complete ${health.json?.lastCompleteAt ?? "?"}`,
}));
await run(2, "Has the data been refreshed in the last 3 hours?", () => {
  const t = Date.parse(health.json?.lastCompleteAt ?? "");
  const age = (Date.now() - t) / 3_600_000;
  return { pass: Number.isFinite(age) && age <= 3, detail: Number.isFinite(age) ? `${age.toFixed(1)} h old` : "no timestamp" };
});
await run(3, "Does llms.txt tell an agent where the API, OpenAPI document and MCP server are?", async () => {
  const r = await get("/llms.txt");
  return { pass: r.status === 200 && ["/api/v1/events", "/api/v1/openapi.json", "/api/mcp"].every((p) => r.text.includes(p)), detail: `HTTP ${r.status}` };
});
await run(4, "Is there a valid OpenAPI 3.1 document with the Event schema?", () => ({
  pass: spec.status === 200 && spec.json?.openapi === "3.1.0" && !!spec.json?.components?.schemas?.Event && !!spec.json?.paths?.["/api/v1/events"],
  detail: `HTTP ${spec.status}`,
}));
await run(5, "Does every live event carry every field the OpenAPI Event schema requires?", () => {
  const required = spec.json?.components?.schemas?.Event?.required ?? [];
  if (!required.length || !events.length) return { pass: false, detail: "no schema or no events" };
  const missing = new Set();
  for (const e of events) for (const k of required) if (!(k in e)) missing.add(k);
  return { pass: missing.size === 0, detail: missing.size ? `missing ${[...missing].join(", ")}` : `${required.length} fields on ${events.length} events` };
});
await run(6, "Can a browser-based agent read the API cross-origin?", () => ({
  pass: list.headers.get("access-control-allow-origin") === "*",
  detail: `allow-origin ${list.headers.get("access-control-allow-origin") ?? "missing"}`,
}));

// Listing and filters
await run(7, "What needs action now?", () => ({
  pass: actNow.status === 200 && Array.isArray(actNow.json?.events) && actNow.json.events.every((e) => e.verdict === "act_now") && typeof actNow.json.total === "number",
  detail: `${actNow.json?.total ?? "?"} Act now events`,
}));
await run(8, "Is the Act now list in rank order (tier today first, then score, then newest evidence)?", () => {
  const es = actNow.json?.events ?? [];
  const rank = (e) => [e.tier === "today" ? 0 : 1, -(e.rankScore ?? 0), -Date.parse(e.newestEvidenceAt)];
  for (let i = 1; i < es.length; i++) {
    const a = rank(es[i - 1]);
    const b = rank(es[i]);
    for (let k = 0; k < 3; k++) {
      if (a[k] < b[k]) break;
      if (a[k] > b[k]) return { pass: false, detail: `${es[i - 1].id} ranks below ${es[i].id}` };
    }
  }
  return { pass: es.length > 0, detail: `${es.length} checked` };
});
await run(9, "Is every event's verdict, tier and score internally consistent?", () => {
  const bad = events.filter((e) => (e.tier !== null && (e.verdict !== "act_now" || !["today", "now"].includes(e.tier))) || (e.rankScore !== null && (!Number.isInteger(e.rankScore) || e.rankScore < 0 || e.rankScore > 11)) || (e.rankWhy !== null && !Array.isArray(e.rankWhy)));
  return { pass: events.length > 0 && bad.length === 0, detail: bad.length ? `${bad.length} inconsistent: ${bad.slice(0, 3).map((e) => e.id).join(", ")}` : `${events.length} checked` };
});
await run(10, "Does every event have a well-formed evidence ladder?", () => {
  const bad = events.filter((e) => !ladderOk(e.ladder) || !ladderConsistent(e.ladder));
  return { pass: events.length > 0 && bad.length === 0, detail: bad.length ? `${bad.length} bad: ${bad.slice(0, 3).map((e) => e.id).join(", ")}` : `${events.length} checked` };
});
await run(11, "Does every event give a verdict reason an agent can quote?", () => {
  const bad = events.filter((e) => typeof e.verdictReason !== "string" || e.verdictReason.trim().length < 10);
  return { pass: events.length > 0 && bad.length === 0, detail: bad.length ? `${bad.length} without a reason` : `${events.length} checked` };
});
await run(12, "What is going on with Fortinet (filter by vendor)?", async () => {
  const r = await get("/api/v1/events?product=fortinet");
  const es = r.json?.events ?? [];
  const off = es.filter((e) => ![e.vendor, e.product, e.title, ...e.affectedProducts.map((p) => `${p.vendor} ${p.product} ${p.slug}`)].join(" ").toLowerCase().includes("fortinet"));
  return { pass: r.status === 200 && off.length === 0, detail: `${es.length} matches, ${off.length} off-topic` };
});
await run(13, "Is this CVE tracked (filter by CVE id)?", async () => {
  const cve = events.flatMap((e) => e.cves).find((c) => CVE_RE.test(c));
  if (!cve) return { pass: false, detail: "no CVE in the list" };
  const r = await get(`/api/v1/events?cve=${cve}`);
  const es = r.json?.events ?? [];
  return { pass: r.status === 200 && es.length >= 1 && es.every((e) => e.cves.includes(cve)), detail: `${cve}: ${es.length} event(s)` };
});
await run(14, "What changed in the last 24 hours (since filter)?", async () => {
  const since = new Date(Date.now() - DAY).toISOString();
  const r = await get(`/api/v1/events?since=${encodeURIComponent(since)}`);
  // An event also counts as changed when older evidence was attached (its ingest time is not public),
  // so this checks the shape and that the filter narrows the list, not each row's timestamps.
  const es = r.json?.events ?? [];
  const narrower = typeof r.json?.total === "number" && typeof list.json?.total === "number" && r.json.total <= list.json.total;
  return { pass: r.status === 200 && Array.isArray(es) && narrower, detail: `${r.json?.total ?? "?"} of ${list.json?.total ?? "?"} changed` };
});
await run(15, "Can an agent page through the whole list without duplicates?", async () => {
  const pages = list.json?.pages ?? 0;
  if (!pages) return { pass: false, detail: "no page count" };
  const seen = new Set(events.map((e) => e.id));
  let dupes = 0;
  let total = events.length;
  for (let p = 2; p <= Math.min(pages, 4); p++) {
    const r = await get(`/api/v1/events?page=${p}`);
    for (const e of r.json?.events ?? []) {
      total++;
      if (seen.has(e.id)) dupes++;
      seen.add(e.id);
    }
  }
  return { pass: dupes === 0 && (pages <= 4 ? total === list.json.total : true), detail: `${pages} pages, ${total} seen, ${dupes} duplicates` };
});
await run(16, "Does a page past the end answer sensibly instead of erroring?", async () => {
  const r = await get("/api/v1/events?page=9999");
  return { pass: r.status === 200 && Array.isArray(r.json?.events), detail: `HTTP ${r.status}, page ${r.json?.page ?? "?"} of ${r.json?.pages ?? "?"}` };
});
await run(17, "Does a bad filter get a clear 400, not a 500?", async () => {
  const a = await get("/api/v1/events?verdict=urgent");
  const b = await get("/api/v1/events?since=yesterday");
  const c = await get("/api/v1/events?cve=notacve");
  return { pass: [a, b, c].every((r) => r.status === 400 && typeof r.json?.error === "string"), detail: `${a.status}/${b.status}/${c.status}` };
});

// One event
await run(18, "Tell me everything about the top Act now event (detail endpoint).", () => ({
  pass: !!ev && detail.status === 200 && isSummary(ev) && ev.id === first?.id && Array.isArray(ev.evidence) && ev.clock && typeof ev.clock === "object",
  detail: ev ? ev.id : `HTTP ${detail?.status ?? "?"}`,
}));
await run(19, "Does every evidence item carry a source link and a date, or an explicit null?", () => {
  if (!ev) return { pass: false, detail: "no event" };
  const bad = ev.evidence.filter((x) => !/^https?:\/\//.test(x.url ?? "") || !(x.publishedAt === null || ISO_RE.test(x.publishedAt)) || typeof x.rung !== "string" || !x.rung || !x.source?.id);
  return { pass: ev.evidence.length > 0 && bad.length === 0, detail: `${ev.evidence.length} items, ${bad.length} bad` };
});
await run(20, "Does the ladder match the evidence shown (no confirmed rung without a confirmed item)?", () => {
  if (!ev) return { pass: false, detail: "no event" };
  const withheld = ev.evidenceWithheld ?? 0;
  const confirmedRungs = RUNGS.filter((r) => ev.ladder[r] === "confirmed");
  const items = (r) => ev.evidence.filter((x) => x.rung === r || (r === "attempts" && x.rung === "exploited") || (r === "talk" && x.rung === "advisory"));
  // Talk and attempts also confirm from two independent reports, as the ladder rules say.
  const covered = confirmedRungs.filter((r) => items(r).some((x) => x.strength === "confirmed") || (["attempts", "talk"].includes(r) && new Set(items(r).filter((x) => x.strength !== "claimed").map((x) => x.source.id)).size >= 2));
  return { pass: covered.length === confirmedRungs.length || withheld > 0, detail: `${covered.length}/${confirmedRungs.length} confirmed rungs backed${withheld ? `, ${withheld} items withheld` : ""}` };
});
await run(21, "Is the clock dated and ordered (disclosure before first report before KEV listing)?", () => {
  if (!ev) return { pass: false, detail: "no event" };
  const c = ev.clock;
  const pts = ["disclosed", "exploitCode", "firstReport", "kevListed", "kevDue"].filter((k) => c[k]);
  const badDate = pts.filter((k) => !DATE_RE.test(c[k].date) || typeof c[k].label !== "string");
  const order = c.disclosed && c.kevListed ? c.disclosed.date <= c.kevListed.date : true;
  return { pass: pts.length > 0 && badDate.length === 0 && order, detail: `${pts.length} points${badDate.length ? `, ${badDate.length} malformed` : ""}${order ? "" : ", KEV before disclosure"}` };
});
await run(22, "Which products are affected, with embedded components linked to their reference?", () => {
  if (!ev) return { pass: false, detail: "no event" };
  const ps = ev.affectedProducts;
  const bad = ps.filter((p) => !p.vendor || !p.product || !p.slug || !["direct", "embedded"].includes(p.kind) || (p.kind === "embedded" && !p.ref));
  return { pass: ps.length > 0 && bad.length === 0, detail: `${ps.length} products, ${bad.length} bad` };
});
await run(23, "Is there a fix or deadline when CISA lists it?", () => {
  if (!ev) return { pass: false, detail: "no event" };
  if (!ev.kevListed) return { pass: true, detail: "not KEV listed, nothing to check" };
  return { pass: DATE_RE.test(ev.kevDateAdded ?? "") && (ev.kevDueDate === null || DATE_RE.test(ev.kevDueDate)) && typeof ev.fix === "string" && ev.fix.length > 0, detail: `KEV ${ev.kevDateAdded}, due ${ev.kevDueDate ?? "none"}, fix ${ev.fix ? "present" : "missing"}` };
});
await run(24, "Does an unknown event id answer 404 with JSON?", async () => {
  const r = await get("/api/v1/events/not-a-real-event");
  return { pass: r.status === 404 && !!r.json, detail: `HTTP ${r.status}` };
});
await run(25, "Does the human page for the event exist and agree on the verdict?", async () => {
  if (!ev) return { pass: false, detail: "no event" };
  const r = await get(`/events/${ev.id}`, { headers: { accept: "text/html" } });
  const label = { act_now: "ACT NOW", watch: "WATCH", low: "LOW" }[ev.verdict];
  return { pass: r.status === 200 && r.text.includes(label), detail: `HTTP ${r.status}, ${label} ${r.text.includes(label) ? "shown" : "missing"}` };
});

// MCP
await run(26, "Does the MCP server list list_events, get_event, search_events and get_track_record?", async () => {
  const rpc = await mcp("tools/list", {});
  const names = (rpc.result?.tools ?? []).map((t) => t.name);
  return { pass: ["list_events", "get_event", "search_events", "get_track_record"].every((t) => names.includes(t)), detail: names.join(", ") || rpc.error?.message || "no tools" };
});
await run(27, "Does list_events over MCP return the same Act now events as the API?", async () => {
  const rpc = await mcp("tools/call", { name: "list_events", arguments: { verdict: "act_now" } }, 2);
  const data = mcpResult(rpc);
  const apiIds = (actNow.json?.events ?? []).map((e) => e.id);
  const mcpIds = (data?.events ?? []).map((e) => e.id);
  const same = apiIds.length > 0 && apiIds.length === mcpIds.length && apiIds.every((id) => mcpIds.includes(id));
  return { pass: !rpc.result?.isError && same, detail: same ? `${mcpIds.length} events agree` : `api ${apiIds.length}, mcp ${mcpIds.length}` };
});
await run(28, "Does get_event over MCP return the event with evidence and a notice?", async () => {
  if (!first) return { pass: false, detail: "no event" };
  const rpc = await mcp("tools/call", { name: "get_event", arguments: { id: first.id } }, 3);
  const data = mcpResult(rpc);
  return { pass: !rpc.result?.isError && data?.event?.id === first.id && Array.isArray(data.event.evidence) && typeof data.notice === "string", detail: data?.event?.id ?? rpc.error?.message ?? "no event" };
});
await run(29, "Does search_events find an event by its CVE id and by vendor?", async () => {
  const cve = first?.cves?.find((c) => CVE_RE.test(c));
  const vendor = first?.vendor;
  if (!cve || !vendor) return { pass: false, detail: "no CVE or vendor on the first event" };
  const a = mcpResult(await mcp("tools/call", { name: "search_events", arguments: { query: cve } }, 4));
  const b = mcpResult(await mcp("tools/call", { name: "search_events", arguments: { query: vendor } }, 5));
  const okA = (a?.matches ?? []).some((e) => e.id === first.id);
  const okB = (b?.matches ?? []).some((e) => e.id === first.id);
  return { pass: okA && okB, detail: `${cve} ${okA ? "found" : "missing"}, ${vendor} ${okB ? "found" : "missing"}` };
});

// Feeds
await run(30, "Is the Act now RSS feed valid and does it name the same events?", async () => {
  const r = await get("/events/feed.xml", { headers: { accept: "application/rss+xml" } });
  const ids = (actNow.json?.events ?? []).slice(0, 5).map((e) => e.id);
  const named = ids.filter((id) => r.text.includes(`/events/${id}`));
  return { pass: r.status === 200 && r.text.startsWith("<?xml") && r.text.includes("<rss") && ids.length > 0 && named.length === ids.length, detail: `HTTP ${r.status}, ${named.length}/${ids.length} of the top Act now events in the feed` };
});

// Track record
await run(31, "Does the track record add up, and does get_track_record over MCP agree with the API?", async () => {
  const r = await get("/api/v1/track-record");
  const a = r.json?.live?.actNow;
  const o = a?.overall;
  const calls = a?.calls ?? [];
  const count = (k) => calls.filter((c) => c.outcome === k).length;
  const sums = o && o.calls === calls.length && o.right === count("right") && o.wrong === count("wrong") && o.pending === count("pending");
  const versions = Object.values(a?.byVersion ?? {}).reduce((n, c) => n + c.calls, 0) === o?.calls;
  const rate = !o || o.right + o.wrong === 0 ? o?.rate === undefined : Math.abs(o.rate - o.right / (o.right + o.wrong)) < 1e-9;
  const prior = calls.every((c) => DATE_RE.test(c.calledOn) && (c.kevDate === null || c.kevDate > c.calledOn));
  const m = mcpResult(await mcp("tools/call", { name: "get_track_record", arguments: {} }, 6));
  const agree = m?.live?.actNow?.overall?.calls === o?.calls;
  return {
    pass: r.status === 200 && !!sums && versions && rate && prior && agree && (r.json?.versions ?? []).some((v) => v.active),
    detail: o ? `${o.calls} early calls: ${o.right} right, ${o.wrong} wrong, ${o.pending} pending; mcp ${agree ? "agrees" : "differs"}` : `HTTP ${r.status}`,
  };
});

const failed = results.filter((r) => !r.pass);
const summary = { base, at: new Date().toISOString(), total: results.length, passed: results.length - failed.length, failed: failed.map((f) => ({ n: f.n, question: f.question, detail: f.detail })), results };
if (asJson) console.log(JSON.stringify(summary, null, 2));
else console.log(failed.length ? `\n${failed.length} of ${results.length} questions failed` : `\nall ${results.length} questions passed`);

if (token) {
  const gh = async (path, init = {}) => {
    const res = await fetch(`https://api.github.com/repos/${repo}${path}`, {
      ...init,
      headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28", "user-agent": "SecurityThreatPulse-agent-tests", "content-type": "application/json", ...(init.headers ?? {}) },
    });
    if (!res.ok) throw new Error(`GitHub ${init.method ?? "GET"} ${path} answered ${res.status}`);
    return res.status === 204 ? null : res.json();
  };
  const open = (await gh(`/issues?labels=${LABEL}&state=open&per_page=100`)).filter((i) => !i.pull_request && i.title.startsWith(TITLE_PREFIX));
  const table = failed.map((f) => `| ${f.n} | ${f.question} | ${f.detail.replace(/\|/g, "/")} |`).join("\n");
  if (failed.length) {
    const body = [
      `The nightly agent test set asked the live site ${results.length} questions at ${summary.at} and ${failed.length} failed.`,
      "",
      "| # | Question | Result |",
      "|---|---|---|",
      table,
      "",
      `Run from GitHub Actions against ${base}. Script: scripts/agent-tests.mjs (\`npm run agent-tests\`).`,
      "Agents: fix the cause and reply here. This issue closes itself once every question passes.",
    ].join("\n");
    if (open.length === 0) {
      await gh("/issues", { method: "POST", body: JSON.stringify({ title: `${TITLE_PREFIX} ${failed.length} of ${results.length} questions failing`, body, labels: [LABEL] }) });
      console.log("Opened an alert issue.");
    } else {
      await gh(`/issues/${open[0].number}/comments`, { method: "POST", body: JSON.stringify({ body: `Still failing at ${summary.at}: ${failed.length} of ${results.length}.\n\n| # | Question | Result |\n|---|---|---|\n${table}` }) });
      console.log(`Alert issue #${open[0].number} is already open; added the latest run.`);
    }
  } else {
    for (const issue of open) {
      await gh(`/issues/${issue.number}/comments`, { method: "POST", body: JSON.stringify({ body: `Recovered: all ${results.length} questions passed at ${summary.at}. Closing.` }) });
      await gh(`/issues/${issue.number}`, { method: "PATCH", body: JSON.stringify({ state: "closed", state_reason: "completed" }) });
      console.log(`Closed alert issue #${issue.number}.`);
    }
  }
} else if (!asJson) {
  console.log("GITHUB_TOKEN not set; not touching issues.");
}
process.exit(failed.length ? 1 : 0);
