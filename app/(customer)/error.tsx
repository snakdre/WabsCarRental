"use client";

import { Button } from "@/components/ui/button";

export default function CustomerError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="max-w-2xl mx-auto px-6 py-24 text-center">
      <h1 className="text-3xl font-bold text-navy mb-2">Something went wrong</h1>
      <p className="text-text-muted-wabs mb-8">
        We couldn&apos;t load this page. It may be a temporary issue.
      </p>
      <Button onClick={reset} className="bg-gold hover:bg-gold-muted text-deep font-semibold">
        Try again
      </Button>
    </div>
  );
}
