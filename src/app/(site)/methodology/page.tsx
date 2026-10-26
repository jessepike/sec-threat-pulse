import { readFileSync } from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import Link from "next/link";
import { ProsePage } from "@/components/prose";
import { headingId, parseMarkdown, renderBlocks, splitTitle, type Block } from "@/lib/content/markdown";
import { CURRENT_RULES_VERSION } from "@/lib/ladder/rules";
import { RULES_CHANGELOG } from "@/lib/ladder/rules/changelog";
import { pageMeta } from "@/lib/site";

export const metadata: Metadata = pageMeta({
  title: "Methodology",
  description: "How Security Threat Pulse places reports on the evidence ladder, sets a verdict, and how often the verdict rules were right on past events.",
  path: "/methodology",
});

// The page renders docs/methodology-rules.md at build time. next.config.ts bundles the file.
const RULES_DOC = path.join(process.cwd(), "docs", "methodology-rules.md");

const fmtDate = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

const SECTION_LEVEL = 2;

export default function Methodology() {
  const { rest } = splitTitle(parseMarkdown(readFileSync(RULES_DOC, "utf8")));
  // Text before the first section heading is the document's opening note.
  const firstSection = rest.findIndex((b) => b.type === "heading" && b.level === SECTION_LEVEL);
  const opening = rest.slice(0, firstSection < 0 ? rest.length : firstSection);
  const body = firstSection < 0 ? [] : rest.slice(firstSection);
  const docSections = body.filter((b): b is Extract<Block, { type: "heading" }> => b.type === "heading" && b.level === SECTION_LEVEL);

  const toc: [string, string][] = [
    ["the-evidence-ladder", "The evidence ladder"],
    ...docSections.map((h): [string, string] => [headingId(h.text), h.text]),
    ["rules-changelog", "Rules changelog"],
    ["where-the-facts-come-from", "Where the facts come from"],
    ["named-organizations-and-claims", "Named organizations and claims"],
    ["what-we-leave-out", "What we leave out"],
    ["corrections", "Corrections"],
  ];

  return (
    <ProsePage
      title="Methodology"
      intro="How we turn public reports into a verdict, and how often the verdict rules were right on past events. The numbers below come from our own backtest, and they include the limits."
      badge={`RULES ${CURRENT_RULES_VERSION.toUpperCase()} ACTIVE`}
      footer={`LAST UPDATED OCT 24, 2026 · RULES ${CURRENT_RULES_VERSION.toUpperCase()}`}
    >
      <nav aria-label="On this page" className="flex flex-col gap-2 rounded-sm border border-line bg-surface px-4 py-3 text-sm">
        <span className="font-mono text-xs tracking-[0.08em] text-faint">ON THIS PAGE</span>
        <ul className="!m-0 !grid !list-none !gap-x-6 !gap-y-1 !pl-0 sm:!grid-cols-2">
          {toc.map(([id, label]) => (
            <li key={id} className="!pl-0">
              <a href={`#${id}`}>{label}</a>
            </li>
          ))}
        </ul>
      </nav>

      <section id="the-evidence-ladder">
        <h2>The evidence ladder</h2>
        <p>Every event sits on five rungs. Each rung is confirmed, reported or has no evidence.</p>
        <ul>
          <li><strong>1 Talk.</strong> Advisories, news and researcher posts discuss the issue.</li>
          <li><strong>2 Exposed.</strong> Real systems are affected, with a figure from an advisory or a news report.</li>
          <li><strong>3 Tried.</strong> Someone reports attack attempts. Confirmed exploitation counts as a successful attempt, so when rung 4 is confirmed, rung 3 is confirmed too. Reported exploitation also makes rung 3 reported.</li>
          <li><strong>4 Exploited.</strong> A trusted list such as CISA KEV, or the vendor, says attacks worked.</li>
          <li><strong>5 Damage.</strong> A filing, a state notice or a breach record links real harm to the event.</li>
        </ul>
        <p>On the page, a solid bar means confirmed. A hatched bar means reported but not confirmed. An outlined bar means no evidence. Each state also has a word, so color is never the only signal.</p>
        <p>A site admin can override a verdict. Every override needs a written reason and is logged. No person or AI model picks a verdict by opinion.</p>
      </section>

      <div className="md" id="verdict-rules-and-the-backtest">
        {renderBlocks(opening)}
        {renderBlocks(body)}
      </div>

      <section id="rules-changelog">
        <h2>Rules changelog</h2>
        <p>
          Each rules version is published and frozen. A new version never edits an old one, so the backtest can replay all of them. The active version is <strong>{CURRENT_RULES_VERSION}</strong>. If a version is wrong, see{" "}
          <a href="#corrections">Corrections</a>.
        </p>
        <ol className="md-changelog">
          {RULES_CHANGELOG.map((c) => (
            <li key={c.version}>
              <p>
                <strong className="font-mono">{c.version}</strong> · {fmtDate(c.date)}
                {c.version === CURRENT_RULES_VERSION ? <span className="ml-2 rounded-sm border border-ok px-1.5 py-0.5 font-mono text-[11px] tracking-[0.08em] text-ok-text">ACTIVE</span> : null}
              </p>
              <p>{c.summary}</p>
              <p className="text-muted">{c.finding}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="where-the-facts-come-from">
        <h2>Where the facts come from</h2>
        <p>We read public sources several times a day. They include CISA KEV, VulnCheck KEV, the CVE List, NVD, FIRST EPSS, CIRCL sightings, SEC 8-K filings, Have I Been Pwned and state attorney general breach notices. Each source has its own terms. We follow them.</p>
        <p>Every statement on an event page links to its source and shows a date. If we lack evidence, the page says so.</p>
      </section>
      <section id="named-organizations-and-claims">
        <h2>Named organizations and claims</h2>
        <p>We name an organization only when an official source names it: a regulatory filing, a breach notice or a government advisory. Each name links to that source and its date.</p>
        <p>Ransomware leak sites list victims too. Those are claims by criminal groups. Some are false or old. If we show one, we label it as a claim, we never treat it as proof of damage, and we never link to stolen data.</p>
      </section>
      <section id="what-we-leave-out">
        <h2>What we leave out</h2>
        <p>This is not a tool for security operations teams. We do not publish indicators of compromise, detection rules or exploit code.</p>
      </section>
      <section id="corrections">
        <h2>Corrections</h2>
        <p>
          Every correction is logged in public with its date and reason. Read the <Link href="/corrections">corrections log</Link>, or follow it as an <a href="/corrections/feed.xml">RSS feed</a>.
        </p>
        <p>
          If something about your organization is wrong, write to <a href="mailto:jp@jessepike.dev">jp@jessepike.dev</a>. We reply within 2 business days, fix errors, and log every
          correction on the corrections page. We remove unconfirmed claims on request. We keep accurate public filings, and we will link to your own statement if you send one.
        </p>
      </section>
    </ProsePage>
  );
}
