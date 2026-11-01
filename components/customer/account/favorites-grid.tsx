import Link from "next/link";
import { listMyFavorites } from "@/lib/queries/account";
import { formatMoney } from "@/lib/utils/format";
import { FavoriteButton } from "./favorite-button";

export async function FavoritesGrid() {
  const favorites = await listMyFavorites();

  if (favorites.length === 0) {
    return (
      <div className="text-center py-16 bg-white border border-gray-200 rounded-lg">
        <p className="text-navy font-semibold mb-2">No favorites yet</p>
        <p className="text-text-muted-wabs mb-6">Tap the heart on any vehicle to save it here.</p>
        <Link href="/vehicles" className="text-sm bg-gold text-deep font-semibold px-6 py-3 rounded hover:bg-gold-muted">
          Browse the fleet →
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="favorites-grid">
      {favorites.map(f => (
        <div key={f.vehicle_id} className="relative bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="absolute top-3 right-3 z-10">
            <FavoriteButton vehicleId={f.vehicle_id} initial variant="icon" />
          </div>
          <Link href={`/vehicles/${f.vehicle_id}`} className="block">
            <div className="aspect-[16/10] bg-gray-100">
              {f.cover_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={f.cover_url} alt={`${f.year} ${f.make} ${f.model}`} className="w-full h-full object-cover" />
              )}
            </div>
            <div className="p-4">
              <p className="text-gold text-xs uppercase tracking-[0.2em]">{f.category}</p>
              <p className="text-navy font-semibold">{f.year} {f.make} {f.model}</p>
              <p className="text-sm text-text-muted-wabs mt-1">{formatMoney(f.daily_price)} / day</p>
            </div>
          </Link>
        </div>
      ))}
    </div>
  );
}
