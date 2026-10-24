import type { Metadata } from "next";
import { ProsePage } from "@/components/prose";

export const metadata: Metadata = { title: "Terms of use", description: "Terms for using Security Threat Pulse. The site gives information only and is not advice." };

export default function Terms() {
  return (
    <ProsePage title="Terms of use" intro="Plain-language terms. A lawyer has not reviewed this draft.">
      <section>
        <h2>Not advice</h2>
        <p>Security Threat Pulse gives general information. It is not legal, security, financial, insurance or investment advice. Your situation is different from the examples here. Talk to a qualified professional before you act, and use your own judgment.</p>
      </section>
      <section>
        <h2>No warranty</h2>
        <p>We provide the site as is. We work to be accurate and timely, but we do not promise that it is complete, current or free of errors. A verdict of Low does not mean a risk is zero. A verdict of Act now does not mean an attack on you is certain.</p>
      </section>
      <section>
        <h2>Limit of liability</h2>
        <p>To the extent the law allows, the site owner is not liable for losses that come from using this site or relying on it.</p>
      </section>
      <section>
        <h2>Sources and links</h2>
        <p>Data comes from third parties, each under its own terms. Credits are in the footer. We link to outside sites and do not control them.</p>
      </section>
      <section>
        <h2>Using our content</h2>
        <p>You may quote short parts with a link back to the page. Do not scrape the site at high volume. A public data feed is planned.</p>
      </section>
      <section>
        <h2>Changes</h2>
        <p>We may change these terms. The date at the bottom shows the latest update. Questions: jesse@keatingpike.com.</p>
      </section>
    </ProsePage>
  );
}
