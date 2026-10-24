// Single signal study: how often does each public signal, on the first day it appears before any
// confirmation, see a confirmation within 30 days? Reproduces the figures quoted in
// docs/methodology-rules.md. Tuning period only unless --reveal-heldout is passed.
//
// Usage: npx tsx scripts/backtest/signal-study.ts [--reveal-heldout] [--circl-lag 1]

import { computeLadder } from "../../src/lib/ladder/compute";
import { isEdgeOrRemoteAccess } from "../../src/lib/ladder/rules/v0";
import { addDays, confirmation, dayNumber, dayString, stateAsOf, type DayState } from "../../src/lib/backtest/replay";
import { finish, inPeriod, HORIZON_DAYS } from "../../src/lib/backtest/score";
import type { Ladder } from "../../src/lib/ladder/types";
import { cli, hiddenNote, setup, weightedCell } from "./common";

const c = cli();
const s = setup(c, "signal-study");
if (!s.revealed) console.log(hiddenNote(s));

type Sig = (st: DayState, ladder: Ladder) => boolean;
const age = (st: DayState) => st.ctx.daysSincePublished ?? Infinity;
const telegramOnly = (st: DayState) => (st.ctx.reportedExploitationSources ?? []).every((x) => x === "telegram");
const corroborated = (st: DayState, l: Ladder) => l.attempts === "confirmed" || st.ctx.exploitMaturity !== "none" || (st.ctx.pocRepoCount ?? 0) > 0 || (st.ctx.epss ?? 0) >= 0.1;

const signals: [string, Sig][] = [
  ["Exploitation reported, CVE 90 days old or newer (v1 rule 3)", (st, l) => l.exploited === "reported" && age(st) <= 90],
  ["  same, CVE 30 days old or newer", (st, l) => l.exploited === "reported" && age(st) <= 30],
  ["  same, Telegram the only reporter", (st, l) => l.exploited === "reported" && age(st) <= 90 && telegramOnly(st)],
  ["  same, a non Telegram reporter", (st, l) => l.exploited === "reported" && age(st) <= 90 && !telegramOnly(st)],
  ["  same, Telegram only but corroborated (attempts, tools, PoC or EPSS 0.1+)", (st, l) => l.exploited === "reported" && age(st) <= 90 && telegramOnly(st) && corroborated(st, l)],
  ["  same, Telegram only and not corroborated", (st, l) => l.exploited === "reported" && age(st) <= 90 && telegramOnly(st) && !corroborated(st, l)],
  ["  same, any age, corroborated", (st, l) => l.exploited === "reported" && corroborated(st, l)],
  ["Exploitation reported, CVE older than 90 days", (st, l) => l.exploited === "reported" && age(st) > 90],
  ["Honeypot attempts confirmed (Shadowserver)", (_, l) => l.attempts === "confirmed" && l.exploited === "none"],
  ["Ready-made tools (Metasploit or nuclei), CVE 90 days or newer", (st) => st.ctx.exploitMaturity === "weaponized" && age(st) <= 90],
  ["Ready-made tools on an edge or remote access product", (st) => st.ctx.exploitMaturity === "weaponized" && isEdgeOrRemoteAccess(st.ctx.vendor, st.ctx.product)],
  ["Three or more PoC repositories, CVE 30 days or newer", (st) => (st.ctx.pocRepoCount ?? 0) >= 3 && age(st) <= 30],
  ["EPSS 0.5 or higher", (st) => (st.ctx.epss ?? 0) >= 0.5],
  ["EPSS 0.3 or higher", (st) => (st.ctx.epss ?? 0) >= 0.3],
  ["CVSS 9 or higher and PoC exists, CVE 30 days or newer", (st) => (st.ctx.cvss ?? 0) >= 9 && st.ctx.exploitMaturity !== "none" && age(st) <= 30],
];

const lastScoreable = addDays(s.ds.dataEnd, -HORIZON_DAYS);
for (const period of s.periods) {
  const accs = signals.map(() => ({ n: 0, hits: 0, wn: 0, whits: 0, wsq: 0 }));
  for (const cve of s.ds.cves) {
    const conf = confirmation(cve, s.replayOpts).at;
    const start = cve.published && cve.published > s.from ? cve.published : s.from;
    const end = conf ? (conf < s.to ? addDays(conf, -1) : s.to) : s.to;
    const w = s.weights[cve.stratum];
    const fired = new Set<number>();
    for (let n = dayNumber(start); n <= dayNumber(end) && fired.size < signals.length; n++) {
      const day = dayString(n);
      const st = stateAsOf(cve, day, s.replayOpts);
      const ladder = computeLadder(st.observations);
      signals.forEach(([, f], i) => {
        if (fired.has(i) || !f(st, ladder)) return;
        fired.add(i);
        if (!inPeriod(day, period) || day > lastScoreable) return;
        const hit = !!conf && conf <= addDays(day, HORIZON_DAYS);
        const a = accs[i];
        a.n++;
        a.wn += w;
        a.wsq += w * w;
        if (hit) {
          a.hits++;
          a.whits += w;
        }
      });
    }
  }
  console.log(`\nPeriod ${period.name} (${period.from}..${period.to}): first day each signal held, before any confirmation; share confirmed within 30 days`);
  console.table(signals.map(([name], i) => ({ signal: name, "weighted (95% CI); sampled hits/firings": weightedCell(finish(accs[i], true)) })));
}
