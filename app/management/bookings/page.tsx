import { parseListParams } from "@/lib/validators/management-bookings";
import { listAllBookings } from "@/lib/queries/management-bookings";
import { BookingsFilters } from "@/components/management/bookings/bookings-filters";
import { BookingsTable } from "@/components/management/bookings/bookings-table";

export const dynamic = "force-dynamic";

export default async function ManagementBookingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const params = parseListParams(raw);
  const bookings = await listAllBookings(params);

  return (
    <main className="max-w-7xl mx-auto p-8">
      <div className="mb-6">
        <p className="text-gold text-xs uppercase tracking-[0.3em] mb-2">Management</p>
        <h1 className="text-3xl font-bold text-navy">Bookings</h1>
        <p className="text-text-muted-wabs mt-2">
          {bookings.length} booking{bookings.length === 1 ? "" : "s"}
        </p>
      </div>
      <BookingsFilters />
      <BookingsTable bookings={bookings} />
    </main>
  );
}
