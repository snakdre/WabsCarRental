import type { NextRequest } from "next/server";
import { parseListParams } from "@/lib/validators/management-bookings";
import { listAllBookings } from "@/lib/queries/management-bookings";
import { getUserRole, isManagerOrAdmin } from "@/lib/utils/roles";
import { toCsv } from "@/lib/utils/csv";
import { STATUS_LABEL, isBookingStatus } from "@/lib/booking-status";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // Middleware already gates /management/*, but belt-and-suspenders — this
  // route produces a CSV with every customer email, so we re-verify.
  const role = await getUserRole();
  if (!isManagerOrAdmin(role)) {
    return new Response("Forbidden", { status: 403 });
  }

  const raw: Record<string, string | string[] | undefined> = {};
  request.nextUrl.searchParams.forEach((value, key) => {
    raw[key] = value;
  });
  const params = parseListParams(raw);
  const bookings = await listAllBookings(params);

  const headers = [
    "Reference",
    "Status",
    "Driver name",
    "Driver email",
    "Vehicle",
    "Pickup date",
    "Return date",
    "Total",
    "Created at",
  ];

  const rows = bookings.map((b) => [
    b.reference,
    isBookingStatus(b.status) ? STATUS_LABEL[b.status] : b.status,
    b.driver_name,
    b.driver_email,
    `${b.vehicle_year} ${b.vehicle_make} ${b.vehicle_model}`,
    b.pickup_date.slice(0, 10),
    b.return_date.slice(0, 10),
    b.total_amount,
    b.created_at,
  ]);

  const body = toCsv(headers, rows);
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="bookings-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
