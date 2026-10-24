"use client";

import { ErrorContent, PlainHeader } from "@/components/ErrorPage";

// Catches errors outside the public site group, such as the board brief.
export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <>
      <PlainHeader />
      <ErrorContent digest={error.digest} reset={reset} />
    </>
  );
}
