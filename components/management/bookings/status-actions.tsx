"use client";

import { useState, useTransition } from "react";
import { transitionBookingStatus } from "@/lib/actions/management-bookings";
import { nextStatusesFor, STATUS_LABEL, DESTRUCTIVE_TRANSITIONS, type BookingStatus } from "@/lib/booking-status";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";

export function StatusActions({ bookingId, currentStatus }: { bookingId: string; currentStatus: string }) {
  const next = nextStatusesFor(currentStatus as BookingStatus);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (next.length === 0) {
    return <p className="text-sm text-text-muted-wabs italic">This booking is in a final state.</p>;
  }

  const submit = (next_status: BookingStatus, note?: string) => {
    setError(null);
    setWarning(null);
    const fd = new FormData();
    fd.set("booking_id", bookingId);
    fd.set("next_status", next_status);
    if (note) fd.set("note", note);
    startTransition(async () => {
      const res = await transitionBookingStatus(fd);
      if (res?.error) setError(res.error);
      else if (res?.warning) setWarning(res.warning);
    });
  };

  return (
    <div className="space-y-3" data-testid="status-actions">
      {next.map((n) => {
        const label = STATUS_LABEL[n];
        const destructive = DESTRUCTIVE_TRANSITIONS.has(n);
        if (!destructive) {
          return (
            <Button
              key={n}
              onClick={() => submit(n)}
              disabled={isPending}
              className="w-full bg-gold hover:bg-gold-muted text-deep font-semibold"
              data-testid={`action-${n}`}
            >
              {label}
            </Button>
          );
        }
        return <DestructiveActionButton key={n} nextStatus={n} label={label} isPending={isPending} onConfirm={submit} />;
      })}
      {error && <p className="text-red-600 text-sm">{error}</p>}
      {warning && <p className="text-yellow-700 bg-yellow-50 border border-yellow-200 rounded px-2 py-1 text-sm">{warning}</p>}
    </div>
  );
}

function DestructiveActionButton({
  nextStatus, label, isPending, onConfirm,
}: {
  nextStatus: BookingStatus;
  label: string;
  isPending: boolean;
  onConfirm: (next: BookingStatus, note?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const requiresNote = nextStatus === "refunded";

  const handle = () => {
    if (requiresNote && !note.trim()) return;
    onConfirm(nextStatus, note.trim() || undefined);
    setOpen(false);
    setNote("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          disabled={isPending}
          className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold"
          data-testid={`action-${nextStatus}`}
        >
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm {label}</DialogTitle>
          <DialogDescription>
            {nextStatus === "refunded"
              ? "Refunds require a note explaining the reason."
              : `This will mark the booking as ${label.toLowerCase()}. Continue?`}
          </DialogDescription>
        </DialogHeader>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={requiresNote ? "Reason for refund (required)…" : "Optional note…"}
          className="w-full min-h-[80px] border border-gray-300 rounded px-3 py-2 text-sm text-navy focus:border-gold focus:outline-none"
          maxLength={500}
        />
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            onClick={handle}
            disabled={requiresNote && !note.trim()}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            Confirm {label}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
