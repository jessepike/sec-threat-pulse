#!/usr/bin/env node
// Outside-host probe. Runs from GitHub Actions every 30 minutes and never from Vercel, so it keeps
// working when the site's own cron dies. Reads /status.json and owns every alert issue:
//   - one titled "[alert] Site freshness: ..." while the site is stale or down;
//   - one titled "[alert] Source <id>: ..." per failing or stale source, and for database storage.
// Each closes with a comment when the report shows recovery. Issues opened here come from the
// Actions bot, so GitHub notifies the owner.
//
// Usage: node scripts/ops/freshness-probe.mjs [base-url]
// Env: GITHUB_TOKEN (issues: write), GITHUB_REPOSITORY (owner/name), SIMULATE=stale|down for a drill.
import { judgeFreshness } from "./judge-freshness.mjs";
import { planAlerts } from "./plan-alerts.mjs";

const base = (process.argv[2] ?? "https://securitythreatpulse.com").replace(/\/$/, "");
const repo = process.env.GITHUB_REPOSITORY ?? "jessepike/sec-threat-pulse";
const token = process.env.GITHUB_TOKEN;
const simulate = process.env.SIMULATE ?? "";
const LABEL = "alert";
const TITLE_PREFIX = "[alert] Site freshness:";
const UA = "SecurityThreatPulse/0.1 (+https://securitythreatpulse.com; jp@jessepike.dev)";

async function probe() {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 20_000);
    const res = await fetch(`${base}/status.json`, { headers: { "user-agent": UA, accept: "application/json" }, cache: "no-store", signal: controller.signal });
    clearTimeout(t);
    let body = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    return { ok: res.ok, status: res.status, body };
  } catch (e) {
    return { ok: false, status: 0, body: null, error: e instanceof Error ? e.message : String(e) };
  }
}

const gh = async (path, init = {}) => {
  const res = await fetch(`https://api.github.com/repos/${repo}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28", "user-agent": "SecurityThreatPulse-probe", "content-type": "application/json", ...(init.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`GitHub ${init.method ?? "GET"} ${path} answered ${res.status}`);
  return res.status === 204 ? null : res.json();
};

const now = new Date();
let result = await probe();
if (simulate === "stale") result = { ok: true, status: 200, body: { state: "delayed", lastCompleteAt: new Date(now.getTime() - 3 * 3_600_000).toISOString(), lastAttemptAt: now.toISOString(), summary: "Drill." } };
if (simulate === "down") result = { ok: false, status: 503, body: null, error: "Drill: simulated outage" };
const verdict = judgeFreshness(result, now);
console.log(`${verdict.state.toUpperCase()} ${base} ${verdict.reason || `last complete ${verdict.lastCompleteAt}`}${simulate ? ` (drill: ${simulate})` : ""}`);

if (!token) {
  console.log("GITHUB_TOKEN not set; not touching issues.");
  process.exit(verdict.state === "ok" ? 0 : 1);
}

const allOpen = (await gh(`/issues?labels=${LABEL}&state=open&per_page=100`)).filter((i) => !i.pull_request);
const open = allOpen.filter((i) => i.title.startsWith(TITLE_PREFIX));

// Per-source and database alerts, from the same report. Skipped in a drill and when the report could
// not be read. A failure here never hides the freshness verdict below.
if (!simulate && result.ok) {
  try {
    const plan = planAlerts(result.body, allOpen, now);
    for (const a of plan.open) {
      await gh("/issues", { method: "POST", body: JSON.stringify({ title: a.title, body: a.body, labels: [LABEL] }) });
      console.log(`Opened an alert issue for ${a.id}.`);
    }
    for (const c of plan.close) {
      await gh(`/issues/${c.number}/comments`, { method: "POST", body: JSON.stringify({ body: `Recovered: \`${c.id}\` is healthy again as of ${now.toISOString()}. Closing.` }) });
      await gh(`/issues/${c.number}`, { method: "PATCH", body: JSON.stringify({ state: "closed", state_reason: "completed" }) });
      console.log(`Closed alert issue #${c.number} for ${c.id}.`);
    }
  } catch (e) {
    console.log(`Source alert sync failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}
if (verdict.state !== "ok") {
  if (open.length === 0) {
    const body = [
      `The outside probe found the site ${verdict.state === "down" ? "down" : "not updating"} at ${now.toISOString()}. ${verdict.reason}`,
      "",
      `Checked from GitHub Actions, not from Vercel, so this fires even when the site's own cron has stopped. Status page: ${base}/status.json. Vercel cron logs and /admin/runs show what stopped.`,
      "Agents: find the cause, fix it, and reply here. This issue closes itself once the probe sees a complete run within the hour.",
      simulate ? "" : "",
      simulate ? `This run was a drill (SIMULATE=${simulate}); the site itself may be fine. The next regular probe run closes it, which proves both halves of the alert path.` : "",
    ]
      .filter((l, i, a) => !(l === "" && a[i - 1] === ""))
      .join("\n");
    await gh("/issues", { method: "POST", body: JSON.stringify({ title: `${TITLE_PREFIX} ${verdict.state === "down" ? "site down" : "not updating"}`, body, labels: [LABEL] }) });
    console.log("Opened an alert issue.");
  } else {
    console.log(`Alert issue #${open[0].number} is already open.`);
  }
  process.exit(simulate ? 0 : 1);
}
for (const issue of open) {
  await gh(`/issues/${issue.number}/comments`, { method: "POST", body: JSON.stringify({ body: `Recovered: the probe saw a complete run at ${verdict.lastCompleteAt} (checked ${now.toISOString()}). Closing.` }) });
  await gh(`/issues/${issue.number}`, { method: "PATCH", body: JSON.stringify({ state: "closed", state_reason: "completed" }) });
  console.log(`Closed alert issue #${issue.number}.`);
}
