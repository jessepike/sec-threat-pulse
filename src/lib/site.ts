import type { Metadata } from "next";

export const SITE_URL = "https://securitythreatpulse.com";
export const SITE_NAME = "Security Threat Pulse";
export const SITE_TAGLINE = "What is real, what is noise, and what to do about it.";
export const SITE_DESCRIPTION =
  "A free, vendor-neutral view of what is happening in cybersecurity, what is real, what is noise, and what to do about it.";

/**
 * Search engines are blocked until launch. Set STP_ALLOW_INDEXING=true to open the site to crawlers.
 * Any other value, or no value, keeps robots.txt on disallow-all and adds a noindex meta tag.
 */
export function indexingAllowed(env: Record<string, string | undefined> = process.env): boolean {
  return env.STP_ALLOW_INDEXING === "true";
}

/**
 * Page metadata with its own Open Graph and Twitter fields. A page that sets openGraph replaces the
 * site default as a whole, so the share image is named here instead of being inherited.
 */
export function pageMeta(args: { title: string; description?: string; path: string; type?: "website" | "article"; modifiedTime?: string; image?: string | "file"; extra?: Metadata }): Metadata {
  const { title, description, path, type = "website", modifiedTime, image, extra } = args;
  return {
    title,
    description,
    alternates: { canonical: path, ...extra?.alternates },
    // image "file": the route has its own opengraph-image file, which Next adds when images is left out.
    openGraph: { type, siteName: SITE_NAME, title, description, url: path, locale: "en_US", ...(image === "file" ? {} : { images: [image ?? "/opengraph-image"] }), ...(modifiedTime ? { modifiedTime } : {}) },
    twitter: { card: "summary_large_image", title, description, ...(image === "file" ? {} : { images: [image ?? "/twitter-image"] }) },
  };
}
