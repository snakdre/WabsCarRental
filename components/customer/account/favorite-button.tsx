"use client";

import { useState, useTransition } from "react";
import { Heart } from "lucide-react";
import { toggleFavorite } from "@/lib/actions/account";

export function FavoriteButton({
  vehicleId, initial, variant = "full",
}: {
  vehicleId: string; initial: boolean; variant?: "full" | "icon";
}) {
  const [favorited, setFavorited] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const onClick = () => {
    const fd = new FormData();
    fd.set("vehicle_id", vehicleId);
    const prev = favorited;
    setFavorited(!prev); // optimistic
    setError(null);
    startTransition(async () => {
      const res = await toggleFavorite(fd);
      if (res?.error) { setFavorited(prev); setError(res.error); }
      else if (typeof res.favorited === "boolean") setFavorited(res.favorited);
    });
  };

  const label = favorited ? "Remove from favorites" : "Save to favorites";
  return (
    <div>
      <button
        type="button"
        onClick={onClick}
        disabled={isPending}
        aria-pressed={favorited}
        aria-label={label}
        data-testid="favorite-button"
        className={
          variant === "icon"
            ? "p-2 rounded-full bg-white/90 hover:bg-white shadow"
            : "inline-flex items-center gap-2 text-sm border border-gray-300 rounded px-3 py-2 text-navy hover:border-gold"
        }
      >
        <Heart className={`w-4 h-4 ${favorited ? "fill-gold text-gold" : "text-navy"}`} />
        {variant === "full" && <span>{favorited ? "Saved" : "Save"}</span>}
      </button>
      {error && <p className="text-red-600 text-xs mt-1">{error}</p>}
    </div>
  );
}
