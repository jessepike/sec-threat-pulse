"use client";

import "./globals.css";
import { ErrorContent, PlainHeader } from "@/components/ErrorPage";

// Replaces the root layout when it fails, so it must supply html and body itself.
// The web fonts load in the root layout, so this page uses system fonts.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en" data-theme="dark">
      <body style={{ fontFamily: "system-ui, sans-serif" }}>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <PlainHeader />
        <ErrorContent digest={error.digest} reset={reset} />
      </body>
    </html>
  );
}
