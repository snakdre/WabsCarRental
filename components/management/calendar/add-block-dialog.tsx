"use client";

import { useEffect, useState, useTransition } from "react";
import { createAvailabilityBlock } from "@/lib/actions/management-availability";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

const inputClass =
  "w-full border border-gray-300 rounded px-3 py-2 text-sm text-navy focus:border-gold focus:outline-none bg-white";

export function AddBlockDialog({
  open,
  onOpenChange,
  vehicleId,
  vehicleLabel,
  initialDate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicleId: string;
  vehicleLabel: string;
  initialDate: string;
}) {
  const [type, setType] = useState<"maintenance" | "blocked">("maintenance");
  const [startDate, setStartDate] = useState(initialDate);
  const [endDate, setEndDate] = useState(initialDate);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Reset form when a new vehicle/date is chosen.
  useEffect(() => {
    setType("maintenance");
    setStartDate(initialDate);
    setEndDate(initialDate);
    setReason("");
    setError(null);
  }, [vehicleId, initialDate]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const fd = new FormData();
    fd.set("vehicle_id", vehicleId);
    fd.set("type", type);
    fd.set("start_date", startDate);
    fd.set("end_date", endDate);
    fd.set("reason", reason);
    startTransition(async () => {
      const res = await createAvailabilityBlock(fd);
      if (res?.error) setError(res.error);
      else onOpenChange(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add availability block</DialogTitle>
          <DialogDescription>{vehicleLabel}</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label htmlFor="block-type">Type</Label>
            <select
              id="block-type"
              value={type}
              onChange={(e) => setType(e.target.value as "maintenance" | "blocked")}
              className={inputClass}
            >
              <option value="maintenance">Maintenance</option>
              <option value="blocked">Blocked</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="block-start">Start date</Label>
              <Input
                id="block-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="block-end">End date</Label>
              <Input
                id="block-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="block-reason">Reason (optional)</Label>
            <textarea
              id="block-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              placeholder="Scheduled oil change…"
              className={`${inputClass} min-h-[72px]`}
            />
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="bg-gold hover:bg-gold-muted text-deep font-semibold"
            >
              {isPending ? "Saving…" : "Create block"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
