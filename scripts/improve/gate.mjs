#!/usr/bin/env node
// CI gate for improve loop pull requests (branches named improve/...). Runs in .github/workflows/ci.yml.
// Reads the pull request's files and labels from GitHub and fails the check when:
//   - docs/improve/PAUSE exists (the owner's off switch),
//   - the change touches a file only the owner may change,
//   - a tier 1 or 2 change has no panel approval for its current head commit and tier: a comment by
//     the repo owner's account holding `<!-- improve-panel: sha=<head sha> tier=<tier> -->`, posted
//     after every reviewer approved (a new commit needs a new approval). Adding the
//     `panel-approved` label only re-runs this check,
//   - a rules change has no `rules-notice` label, or that label is under 48 hours old.
// Other branches pass straight through. A protected file: changing it needs the tier 2 panel.
//
// Env: GITHUB_TOKEN, GITHUB_REPOSITORY, PR_NUMBER, HEAD_REF, HEAD_SHA.
import { existsSync, appendFileSync } from "node:fs";
import { classify } from "./tier.mjs";
import { panelApproves } from "./panel.mjs";

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

const repo = process.env.GITHUB_REPOSITORY;
const pr = process.env.PR_NUMBER;
const token = process.env.GITHUB_TOKEN;
const sha = process.env.HEAD_SHA;
if (!repo || !pr || !token || !sha) fail("GITHUB_REPOSITORY, PR_NUMBER, HEAD_SHA and GITHUB_TOKEN are needed.");

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

// The off switch is read from main as it is now, so a pause added after this branch was cut still counts.
const pause = await fetch(`https://api.github.com/repos/${repo}/contents/docs/improve/PAUSE?ref=main`, {
  headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "user-agent": "SecurityThreatPulse-improve-gate" },
});
if (pause.status === 200 || existsSync("docs/improve/PAUSE")) fail("docs/improve/PAUSE exists: the owner has paused the loop.");
if (pause.status !== 404) fail(`Could not read the pause state from main (HTTP ${pause.status}), so the gate fails closed.`);

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
const comments = await all(`/issues/${pr}/comments`);
if (!panelApproves(comments, sha, tier)) {
  fail(`Tier ${tier} needs the review panel's approval of commit ${sha.slice(0, 7)}: a comment by the owner's account with \`<!-- improve-panel: sha=${sha} tier=${tier} -->\`, posted after every reviewer approves (docs/improve/program.md).`);
}
if (tier === "rules") {
  if (!labels.includes("rules-notice")) fail("A rules change needs the `rules-notice` label and a 48 hour notice to the owner.");
  const events = await all(`/issues/${pr}/events`);
  const at = events.filter((e) => e.event === "labeled" && e.label?.name === "rules-notice").map((e) => Date.parse(e.created_at)).sort((a, b) => b - a)[0];
  const hours = at ? (Date.now() - at) / 3_600_000 : 0;
  if (hours < NOTICE_HOURS) fail(`The rules notice went up ${hours.toFixed(1)} hours ago. It must stand ${NOTICE_HOURS} hours before merge.`);
}
summary("Improve gate passed.");
