"use client";

import { useState, useTransition } from "react";
import { createDraftBooking } from "@/lib/actions/checkout";

export function ReviewSubmitForm({ hidden }: { hidden: Record<string, string> }) {
  const [error, setError] = useState<string | null>(null);
  const [terms, setTerms] = useState(false);
  const [isPending, startTransition] = useTransition();

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (!terms) { setError("You must accept terms."); return; }
    const fd = new FormData();
    for (const [k, v] of Object.entries(hidden)) {
      // Rename URL params to what the server action's Zod schema expects
      const name = k === "return" ? "return_date"
        : k === "pickup" ? "pickup_date"
        : k === "vehicle" ? "vehicle_id"
        : k;
      fd.set(name, v);
    }
    fd.set("terms_accepted", "on");
    startTransition(async () => {
      const res = await createDraftBooking(fd);
      if (res && "error" in res) setError(res.error);
      // On success the server action calls redirect() and throws — control never returns here.
    });
  };

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4" data-testid="review-submit-form">
      <label className="flex items-start gap-2 text-sm text-navy">
        <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} required className="mt-1" />
        <span>I agree to the rental terms and cancellation policy.</span>
      </label>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button type="submit" disabled={isPending}
        className="bg-gold hover:bg-gold-muted text-deep font-semibold px-6 py-3 rounded disabled:opacity-60">
        {isPending ? "Creating booking..." : "Confirm & continue to payment"}
      </button>
    </form>
  );
}
