"use client";

import { useState, useTransition } from "react";
import { cancelMyBooking } from "@/lib/actions/account";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";

export function CancelBookingDialog({ bookingId, reference, paid }: { bookingId: string; reference: string; paid: boolean }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const confirm = () => {
    const fd = new FormData();
    fd.set("booking_id", bookingId);
    fd.set("reason", reason);
    setError(null);
    startTransition(async () => {
      const res = await cancelMyBooking(fd);
      if (res?.error) setError(res.error);
      else setOpen(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full border-red-300 text-red-700 hover:bg-red-50" data-testid="cancel-booking">
          Cancel booking
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel {reference}?</DialogTitle>
          <DialogDescription>
            This can&apos;t be undone and the vehicle will be released to other customers.
            {paid && " Your payment will be refunded in full."}
          </DialogDescription>
        </DialogHeader>
        <label className="block">
          <span className="block text-xs font-semibold uppercase tracking-wider text-text-muted-wabs mb-1">Reason (optional)</span>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            maxLength={500}
            className="w-full min-h-[80px] border border-gray-300 rounded px-3 py-2 text-sm text-navy focus:border-gold focus:outline-none"
          />
        </label>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>Keep booking</Button>
          <Button onClick={confirm} disabled={isPending} className="bg-red-600 hover:bg-red-700 text-white" data-testid="confirm-cancel">
            {isPending ? "Cancelling…" : "Yes, cancel"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
