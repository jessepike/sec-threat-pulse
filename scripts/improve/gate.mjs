#!/usr/bin/env node
// CI gate for improve loop pull requests (branches named improve/...). Runs in .github/workflows/ci.yml.
// Reads the pull request's files and labels from GitHub and fails the check when:
//   - docs/improve/PAUSE exists (the owner's off switch),
//   - the change touches a file only the owner may change,
//   - a tier 1 or 2 change has no `panel-approved` label (the review panel's record),
//   - a rules change has no `rules-notice` label, or that label is under 48 hours old.
// Other branches pass straight through. A protected file: changing it needs the tier 2 panel.
//
// Env: GITHUB_TOKEN, GITHUB_REPOSITORY, PR_NUMBER, HEAD_REF.
import { existsSync, appendFileSync } from "node:fs";
import { classify } from "./tier.mjs";

export const NOTICE_HOURS = 48;
const head = process.env.HEAD_REF ?? "";
const summary = (s) => {
  console.log(s);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, s + "\n");
};

if (!head.startsWith("improve/")) {
  console.log(`Not an improve branch (${head || "none"}); nothing to check.`);
  process.exit(0);
}

const fail = (why) => {
  summary(`**Improve gate failed.** ${why}`);
  process.exit(1);
};

if (existsSync("docs/improve/PAUSE")) fail("docs/improve/PAUSE exists: the owner has paused the loop.");

const repo = process.env.GITHUB_REPOSITORY;
const pr = process.env.PR_NUMBER;
const token = process.env.GITHUB_TOKEN;
if (!repo || !pr || !token) fail("GITHUB_REPOSITORY, PR_NUMBER and GITHUB_TOKEN are needed.");

async function gh(path) {
  const res = await fetch(`https://api.github.com/repos/${repo}${path}`, {
    headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28", "user-agent": "SecurityThreatPulse-improve-gate" },
  });
  if (!res.ok) throw new Error(`GitHub GET ${path} answered ${res.status}`);
  return res.json();
}
async function all(path) {
  const out = [];
  for (let page = 1; page < 20; page++) {
    const batch = await gh(`${path}${path.includes("?") ? "&" : "?"}per_page=100&page=${page}`);
    out.push(...batch);
    if (batch.length < 100) break;
  }
  return out;
}

// A rename is classified on both sides, so moving a protected file out of its place still counts.
const files = (await all(`/pulls/${pr}/files`)).flatMap((f) => {
  const row = { path: f.filename, status: f.status, additions: f.additions, deletions: f.deletions };
  return f.previous_filename ? [row, { path: f.previous_filename, status: "removed", additions: 0, deletions: 0 }] : [row];
});
const { tier, reasons, lines } = classify(files);
const labels = (await gh(`/issues/${pr}`)).labels.map((l) => l.name);
summary(`Improve gate: tier **${tier}**, ${files.length} files, ${lines} counted lines.${reasons.length ? "\n\n- " + reasons.join("\n- ") : ""}`);

if (tier === "owner") fail("This change touches a file only the owner may change. Take that file out of the pull request.");
if (tier === 0) process.exit(0);
if (!labels.includes("panel-approved")) fail(`Tier ${tier} needs the review panel. Add the \`panel-approved\` label after every reviewer approves (docs/improve/program.md).`);
if (tier === "rules") {
  if (!labels.includes("rules-notice")) fail("A rules change needs the `rules-notice` label and a 48 hour notice to the owner.");
  const events = await all(`/issues/${pr}/events`);
  const at = events.filter((e) => e.event === "labeled" && e.label?.name === "rules-notice").map((e) => Date.parse(e.created_at)).sort((a, b) => b - a)[0];
  const hours = at ? (Date.now() - at) / 3_600_000 : 0;
  if (hours < NOTICE_HOURS) fail(`The rules notice went up ${hours.toFixed(1)} hours ago. It must stand ${NOTICE_HOURS} hours before merge.`);
}
summary("Improve gate passed.");
