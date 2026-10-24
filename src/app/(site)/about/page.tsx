import type { Metadata } from "next";
import { pageMeta } from "@/lib/site";
import { ProsePage } from "@/components/prose";

export const metadata: Metadata = pageMeta({ title: "About and disclosure", description: "Who runs Security Threat Pulse, how it stays vendor neutral, and how it uses AI.", path: "/about" });

export default function About() {
  return (
    <ProsePage title="About and disclosure" intro="Security Threat Pulse is a free site for security leaders, executives, boards, insurers and investors. It says what is happening, what is real and what to do.">
      <section>
        <h2>Who runs it</h2>
        <p>Jesse Pike runs this site as an independent project. Contact: jesse@keatingpike.com.</p>
        <p>The site is not run by, paid for or reviewed by any employer or vendor. Views and verdicts on this site are not those of any company Jesse works with.</p>
      </section>
      <section>
        <h2>Vendor neutral</h2>
        <ul>
          <li>No vendor pays for coverage, ranking or wording.</li>
          <li>We do not sell products or services through this site.</li>
          <li>We name vendors only when a flaw is in their product, and we report their fixes when they exist.</li>
        </ul>
        <p>If this changes, for example with sponsors, we will say so here first.</p>
      </section>
      <section>
        <h2>How AI is used</h2>
        <ul>
          <li>Verdicts come from published rules. A language model does not set them.</li>
          <li>AI tools helped write the site code. They may help draft summaries. Text drafted by AI will be labeled as such, and a person reviews it.</li>
          <li>The sample pages you may see in preview builds are made-up and marked as sample data.</li>
        </ul>
      </section>
      <section>
        <h2>What we cannot promise</h2>
        <p>Our sources can be late or wrong. We show the source and the date so you can judge for yourself. We correct mistakes in public.</p>
      </section>
    </ProsePage>
  );
}
