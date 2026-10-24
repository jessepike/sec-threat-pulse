"use client";

export default function SiteError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main id="main" className="mx-auto flex max-w-[720px] flex-col gap-4 px-4 py-20 sm:px-6">
      <h1 className="m-0 font-display text-3xl font-bold">Data is not available right now</h1>
      <p className="m-0 text-base leading-[1.6] text-fg-2">
        The page could not load its data. This is a fault on our side. Nothing you did caused it. Try again in a few minutes.
      </p>
      <button
        type="button"
        onClick={reset}
        className="w-fit cursor-pointer rounded-[3px] border border-line-strong bg-transparent px-5 py-3 font-mono text-sm text-fg"
      >
        TRY AGAIN
      </button>
    </main>
  );
}
