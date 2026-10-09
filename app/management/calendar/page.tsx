import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getCalendarData } from "@/lib/queries/management-availability";
import { parseCalendarParams } from "@/lib/validators/calendar";
import { formatMonth, prevMonth, nextMonth } from "@/lib/utils/calendar";
import { CalendarGrid } from "@/components/management/calendar/calendar-grid";

export const dynamic = "force-dynamic";

export default async function ManagementCalendarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const { year, month } = parseCalendarParams(raw);
  const data = await getCalendarData(year, month);
  const prev = prevMonth(year, month);
  const next = nextMonth(year, month);
  const prevHref = `/management/calendar?year=${prev.year}&month=${prev.month}`;
  const nextHref = `/management/calendar?year=${next.year}&month=${next.month}`;

  return (
    <main className="max-w-7xl mx-auto p-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-gold text-xs uppercase tracking-[0.3em] mb-2">Management</p>
          <h1 className="text-3xl font-bold text-navy">Calendar</h1>
          <p className="text-text-muted-wabs mt-2">{formatMonth(year, month)}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={prevHref} className="inline-flex items-center gap-1 border border-gray-300 bg-white hover:bg-gray-50 text-navy px-3 py-2 rounded text-sm">
            <ChevronLeft className="w-4 h-4" />
            Prev
          </Link>
          <Link href={nextHref} className="inline-flex items-center gap-1 border border-gray-300 bg-white hover:bg-gray-50 text-navy px-3 py-2 rounded text-sm">
            Next
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
      <CalendarGrid year={year} month={month} data={data} />
    </main>
  );
}
