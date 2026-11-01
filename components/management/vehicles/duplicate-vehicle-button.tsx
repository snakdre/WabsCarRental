"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy } from "lucide-react";
import { duplicateVehicle } from "@/lib/actions/management-vehicle-images";
import { Button } from "@/components/ui/button";

export function DuplicateVehicleButton({ vehicleId }: { vehicleId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const onClick = () => {
    if (!confirm("Create a draft copy of this vehicle? VIN and licence plate won't be copied.")) return;
    const fd = new FormData();
    fd.set("vehicle_id", vehicleId);
    setError(null);
    startTransition(async () => {
      const res = await duplicateVehicle(fd);
      if (res.error) setError(res.error);
      else if (res.vehicle_id) router.push(`/management/vehicles/${res.vehicle_id}`);
    });
  };

  return (
    <div className="flex flex-col items-end">
      <Button variant="outline" onClick={onClick} disabled={isPending} data-testid="duplicate-vehicle">
        <Copy className="w-4 h-4 mr-2" /> {isPending ? "Duplicating…" : "Duplicate"}
      </Button>
      {error && <p className="text-red-600 text-xs mt-1">{error}</p>}
    </div>
  );
}
