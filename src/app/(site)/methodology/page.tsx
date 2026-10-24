import type { Metadata } from "next";
import { ProsePage } from "@/components/prose";

export const metadata: Metadata = { title: "Methodology", description: "How Security Threat Pulse groups reports, places them on the evidence ladder and sets a verdict." };

export default function Methodology() {
  return (
    <ProsePage title="Methodology" intro="How we turn public reports into a verdict. This is a first draft. The rules are placeholders until we test them against past events.">
      <section>
        <h2>The evidence ladder</h2>
        <p>Every event sits on five rungs. Each rung is confirmed, reported or has no evidence.</p>
        <ul>
          <li><strong>1 Talk.</strong> Advisories, news and researcher posts discuss the issue.</li>
          <li><strong>2 Exposed.</strong> Real systems are affected, with a figure from an advisory or a news report.</li>
          <li><strong>3 Tried.</strong> Someone reports attack attempts.</li>
          <li><strong>4 Exploited.</strong> A trusted list such as CISA KEV, or the vendor, says attacks worked.</li>
          <li><strong>5 Damage.</strong> A filing, a state notice or a breach record links real harm to the event.</li>
        </ul>
        <p>On the page, a solid bar means confirmed. A hatched bar means reported but not confirmed. An outlined bar means no evidence. Each state also has a word, so color is never the only signal.</p>
      </section>
      <section>
        <h2>Verdicts</h2>
        <p>There are three verdicts: Act now, Watch and Low. Each has a shape and a word. A set of versioned rules sets the verdict from the ladder and its context. No person or AI model picks it by opinion.</p>
        <p>A site admin can override a verdict. Every override needs a written reason and is logged.</p>
        <p>The current rules are version 0. They are a placeholder. We will publish each rules version and measure it against past events before we call it ready.</p>
      </section>
      <section>
        <h2>Where the facts come from</h2>
        <p>We read public sources several times a day. They include CISA KEV, VulnCheck KEV, the CVE List, NVD, FIRST EPSS, CIRCL sightings, SEC 8-K filings, Have I Been Pwned and state attorney general breach notices. Each source has its own terms. We follow them.</p>
        <p>Every statement on an event page links to its source and shows a date. If we lack evidence, the page says so.</p>
      </section>
      <section>
        <h2>Claims from criminal groups</h2>
        <p>Ransomware leak sites list victims. Those listings are claims. Some are false or old. We label them as claims and never use them alone to confirm damage.</p>
      </section>
      <section>
        <h2>What we leave out</h2>
        <p>This is not a tool for security operations teams. We do not publish indicators of compromise, detection rules or exploit code.</p>
      </section>
      <section>
        <h2>Corrections</h2>
        <p>If something is wrong, tell us at jesse@keatingpike.com. We aim to correct errors within 24 hours and to note the change in public.</p>
      </section>
    </ProsePage>
  );
}
