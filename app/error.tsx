"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("JanVaani client error", error); }, [error]);
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <div role="alert" className="max-w-lg space-y-2 rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 text-amber-900">
        <p className="text-base font-semibold">JanVaani hit an error while drawing the page</p>
        <p className="break-words font-mono text-xs">{error.message || "Unknown error"}{error.digest ? ` (digest ${error.digest})` : ""}</p>
      </div>
      <div className="flex gap-2">
        <Button onClick={reset}>Try again</Button>
        <Button variant="outline" onClick={() => window.location.reload()}>Reload page</Button>
      </div>
    </main>
  );
}
