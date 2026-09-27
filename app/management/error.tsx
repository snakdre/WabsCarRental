"use client";

import { Button } from "@/components/ui/button";

export default function ManagementError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="max-w-2xl mx-auto text-center py-24 px-6">
      <h1 className="text-2xl font-bold text-navy mb-2">Something went wrong</h1>
      <p className="text-text-muted-wabs mb-8">We couldn&apos;t load this management page.</p>
      <Button onClick={reset} className="bg-gold hover:bg-gold-muted text-deep font-semibold">
        Try again
      </Button>
    </div>
  );
}
