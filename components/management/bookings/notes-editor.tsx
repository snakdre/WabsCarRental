"use client";

import { useState, useTransition } from "react";
import { updateBookingNotes } from "@/lib/actions/management-bookings";
import { Button } from "@/components/ui/button";

export function NotesEditor({ bookingId, initialNotes }: { bookingId: string; initialNotes: string | null }) {
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setStatus("idle");
    const fd = new FormData();
    fd.set("booking_id", bookingId);
    fd.set("notes", notes);
    startTransition(async () => {
      const res = await updateBookingNotes(fd);
      if (res?.error) { setStatus("error"); setError(res.error); }
      else setStatus("saved");
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3" data-testid="notes-editor">
      <label className="block text-sm font-semibold uppercase tracking-wider text-text-muted-wabs">
        Internal notes (staff only)
      </label>
      <textarea
        value={notes}
        onChange={(e) => { setNotes(e.target.value); setStatus("idle"); }}
        placeholder="Add internal notes about this booking…"
        maxLength={2000}
        className="w-full min-h-[120px] border border-gray-300 rounded px-3 py-2 text-sm text-navy focus:border-gold focus:outline-none bg-white"
      />
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending} className="bg-gold hover:bg-gold-muted text-deep font-semibold">
          {isPending ? "Saving…" : "Save notes"}
        </Button>
        {status === "saved" && <span className="text-green-700 text-sm">Saved</span>}
        {status === "error" && <span className="text-red-600 text-sm">{error}</span>}
      </div>
    </form>
  );
}
