"use client";

import { Button } from "@/components/ui";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-start gap-4 pt-20">
      <p className="meta text-signal">Error {error.digest ?? ""}</p>
      <h1 className="display text-[clamp(2rem,5vw,3rem)]">Something came unstuck.</h1>
      <p className="max-w-lg text-sm leading-relaxed text-ink-2">
        The app hit an unexpected problem. Your data is safe — nothing was half-written. Try again,
        and if it keeps happening, check the terminal running the dev server.
      </p>
      <pre className="hairline max-w-lg overflow-x-auto rounded-[3px] bg-paper-2 p-3 text-[12px] text-ink-2">
        {error.message}
      </pre>
      <Button variant="primary" size="lg" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
