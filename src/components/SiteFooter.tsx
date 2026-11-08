import Link from "next/link";
import { cookies } from "next/headers";
import { THEME_COOKIE, parseTheme } from "./theme";
import { ThemeToggle } from "./ThemeToggle";
import { ExternalLink } from "./ui";

export async function SiteFooter() {
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <footer className="border-t border-line bg-header">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-8 px-4 py-8 sm:px-6">
        <div className="flex flex-wrap justify-between gap-6">
          <p className="m-0 max-w-[720px] text-sm leading-[1.6] text-muted">
            Vendor neutral. Built from public sources: CISA KEV, VulnCheck, FIRST EPSS, NVD, CIRCL and researcher
            reports. Verdicts follow published rules. We say when evidence is missing.
          </p>
          <ThemeToggle initial={theme} />
        </div>

        <section aria-labelledby="attr" className="flex flex-col gap-3">
          <h2 id="attr" className="m-0 font-mono text-xs font-bold tracking-[0.1em] text-muted">
            SOURCE CREDITS
          </h2>
          <ul className="m-0 grid list-none gap-x-8 gap-y-2 p-0 text-[13px] leading-[1.55] text-muted md:grid-cols-2">
            <li>Exploited-flaw data includes VulnCheck KEV.</li>
            <li>
              Breach data from <ExternalLink href="https://haveibeenpwned.com">Have I Been Pwned</ExternalLink>, licensed under CC BY 4.0.
            </li>
            <li>This product uses the NVD API but is not endorsed or certified by the NVD.</li>
            <li>
              Exploit probability scores from <ExternalLink href="https://www.first.org/epss/">FIRST EPSS</ExternalLink>.
            </li>
            <li>
              Advisories from <ExternalLink href="https://www.cisa.gov/known-exploited-vulnerabilities-catalog">CISA</ExternalLink>,{" "}
              <ExternalLink href="https://cert.europa.eu/">CERT-EU</ExternalLink> and the{" "}
              <ExternalLink href="https://www.ncsc.gov.uk/">UK NCSC</ExternalLink> are linked and credited to their publishers.
            </li>
          </ul>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line-soft pt-5 font-mono text-xs tracking-[0.08em] text-faint">
          <nav aria-label="About this site" className="flex flex-wrap gap-x-5 gap-y-1">
            <Link href="/methodology" className="py-2">METHODOLOGY</Link>
            <Link href="/track-record" className="py-2">TRACK RECORD</Link>
            <Link href="/corrections" className="py-2">CORRECTIONS</Link>
            <Link href="/about" className="py-2">ABOUT</Link>
            <Link href="/terms" className="py-2">TERMS</Link>
            <Link href="/privacy" className="py-2">PRIVACY</Link>
          </nav>
          <div>SECURITYTHREATPULSE.COM · PRE-LAUNCH PREVIEW</div>
        </div>
      </div>
    </footer>
  );
}
