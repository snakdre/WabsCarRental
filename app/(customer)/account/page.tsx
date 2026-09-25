import { BookingsTable } from "@/components/customer/account/bookings-table";

export const dynamic = "force-dynamic";

export default function AccountPage() {
  return (
    <main className="max-w-6xl mx-auto p-8">
      <div className="mb-8">
        <p className="text-gold text-xs uppercase tracking-[0.3em] mb-2">Account</p>
        <h1 className="text-3xl font-bold text-navy">Your bookings</h1>
      </div>
      <BookingsTable />
    </main>
  );
}
