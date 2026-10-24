"use client";

import { ErrorContent } from "@/components/ErrorPage";

export default function SiteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorContent digest={error.digest} reset={reset} />;
}
