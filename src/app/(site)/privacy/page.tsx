import type { Metadata } from "next";
import { ProsePage } from "@/components/prose";

export const metadata: Metadata = { title: "Privacy", description: "What Security Threat Pulse collects about visitors. Very little." };

export default function Privacy() {
  return (
    <ProsePage title="Privacy" intro="We collect very little. A lawyer has not reviewed this draft.">
      <section>
        <h2>What we collect</h2>
        <ul>
          <li>No accounts, no sign-up and no forms for visitors.</li>
          <li>No advertising or tracking cookies, and no third-party analytics at this time.</li>
          <li>Our host keeps standard server logs, such as IP address, page and time. These are used to run and protect the site.</li>
        </ul>
      </section>
      <section>
        <h2>The one cookie</h2>
        <p>If you pick the dark or grey theme in the footer, we store that choice in a cookie named stp-theme for one year. It holds no personal data.</p>
      </section>
      <section>
        <h2>Fonts</h2>
        <p>Fonts are served from this site. Your browser does not contact a font provider.</p>
      </section>
      <section>
        <h2>Sharing</h2>
        <p>We do not sell visitor data. If we add analytics later, we will update this page first and choose a tool that does not track you across sites.</p>
      </section>
      <section>
        <h2>Contact</h2>
        <p>Questions or requests: jesse@keatingpike.com.</p>
      </section>
    </ProsePage>
  );
}
