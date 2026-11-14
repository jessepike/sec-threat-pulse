// Risk tier of a change, from the files it touches. Pure, unit tested (src/lib/improve/tier.test.ts).
// A protected file: changing it needs the tier 2 review panel.
//
// Tiers (docs/improve/program.md, "Review panel"):
//   0      docs, ledger, status and lesson notes            Codex review, checks green
//   1      pages, components, library code, adapters        Codex + a fresh Claude reviewer, both approve
//   2      schema, workflows, new sources, the scorecard,   Codex + two Claude reviewers (one adversarial),
//          security, public methodology, dependencies       all approve
//   rules  a rules version                                  tier 2 panel, held-out win, 48 hour notice
//   owner  intent, the off switch, policy                   never on an improve branch: Jess only

/** Changes bigger than this count as tier 2 whatever they touch. Lockfiles and fixtures are not counted. */
export const MAX_LINES_BELOW_TIER2 = 400;

const OWNER = [/^intent\.md$/, /^docs\/improve\/PAUSE$/, /^docs\/policy-claims-and-takedown\.md$/, /^LICENSE$/];
const RULES = [/^src\/lib\/ladder\/rules\//];
const TIER2 = [
  /^drizzle\//, /^src\/lib\/db\//, /^drizzle\.config\.ts$/,
  /^\.github\//,
  /^src\/lib\/ingest\/registry\.ts$/, /^docs\/source-registry\.md$/,
  /^next\.config\.ts$/, /^src\/auth\.ts$/, /^src\/proxy\.ts$/, /^src\/middleware\.ts$/, /^src\/app\/admin\//, /^src\/app\/api\/(cron|admin|auth)\//, /^src\/lib\/admin\//,
  /^package(-lock)?\.json$/, /^vercel\.json$/,
  /^scripts\/improve\//, /^src\/lib\/improve\//, /^docs\/improve\/program\.md$/,
  /^scripts\/backtest\//, /^src\/lib\/backtest\//, /^data\/backtest\//, /^reports\/backtest\//,
  /^scripts\/agent-tests\.mjs$/, /^scripts\/smoke\.mjs$/, /^scripts\/ops\//, /^scripts\/db-migrate\.mjs$/,
  /^docs\/methodology-rules\.md$/, /^src\/app\/\(site\)\/methodology\//,
  /^AGENTS\.md$/, /^CLAUDE\.md$/, /^docs\/routine\.md$/, /^decisions\.md$/,
  /^src\/lib\/ladder\/(?!rules\/)/,
];
const TIER0 = [/^docs\//, /^[^/]+\.md$/, /^reports\/improve\//];
/** New adapters are new sources: tier 2. Edits to an existing adapter are tier 1. */
const ADAPTER = /^src\/lib\/ingest\/adapters\/[^/]+\.ts$/;
const NOT_COUNTED = [/^package-lock\.json$/, /__fixtures__\//, /^data\//, /^reports\//];

const RANK = { 0: 0, 1: 1, 2: 2, rules: 3, owner: 4 };

/**
 * @param {{ path: string, status?: string, additions?: number, deletions?: number }[]} files
 *   status is GitHub's ("added", "modified", "removed", "renamed"); additions and deletions are line counts
 * @returns {{ tier: 0 | 1 | 2 | "rules" | "owner", reasons: string[], lines: number }}
 */
export function classify(files) {
  let tier = 0;
  const reasons = [];
  const bump = (t, why) => {
    if (RANK[t] > RANK[tier]) tier = t;
    if (RANK[t] > 0) reasons.push(why);
  };
  let lines = 0;
  for (const f of files) {
    const p = f.path;
    if (!NOT_COUNTED.some((r) => r.test(p))) lines += (f.additions ?? 0) + (f.deletions ?? 0);
    if (OWNER.some((r) => r.test(p))) bump("owner", `${p} is the owner's alone`);
    else if (RULES.some((r) => r.test(p))) bump("rules", `${p} is verdict rules`);
    else if (ADAPTER.test(p) && f.status === "added") bump(2, `${p} adds a source`);
    else if (TIER2.some((r) => r.test(p))) bump(2, `${p} is tier 2`);
    else if (TIER0.some((r) => r.test(p))) bump(0, "");
    else bump(1, `${p} is code or pages`);
  }
  if (lines > MAX_LINES_BELOW_TIER2) bump(2, `${lines} changed lines is over ${MAX_LINES_BELOW_TIER2}`);
  return { tier, reasons: [...new Set(reasons)], lines };
}
