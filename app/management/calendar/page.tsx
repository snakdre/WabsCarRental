import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getCalendarRange } from "@/lib/queries/management-availability";
import { parseCalendarView } from "@/lib/validators/calendar";
import {
  formatMonth, prevMonth, nextMonth, monthDates, dateRange, startOfWeek, addDays, formatWeek,
} from "@/lib/utils/calendar";
import { todayUTC } from "@/lib/utils/month-range";
import { CalendarGrid } from "@/components/management/calendar/calendar-grid";

export const dynamic = "force-dynamic";

const btn = "inline-flex items-center gap-1 border border-gray-300 bg-white hover:bg-gray-50 text-navy px-3 py-2 rounded text-sm";

export default async function ManagementCalendarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const today = todayUTC();
  const view = parseCalendarView(await searchParams, today);

  let dates: string[];
  let title: string;
  let prevHref: string;
  let nextHref: string;
  let todayHref: string;
  let switchHref: string;

  if (view.view === "week") {
    const start = startOfWeek(view.start);
    dates = dateRange(start, 7);
    title = formatWeek(start);
    prevHref = `/management/calendar?view=week&start=${addDays(start, -7)}`;
    nextHref = `/management/calendar?view=week&start=${addDays(start, 7)}`;
    todayHref = `/management/calendar?view=week`;
    const [y, m] = start.split("-").map(Number);
    switchHref = `/management/calendar?year=${y}&month=${m}`;
  } else {
    const { year, month } = view;
    dates = monthDates(year, month);
    title = formatMonth(year, month);
    const p = prevMonth(year, month);
    const n = nextMonth(year, month);
    prevHref = `/management/calendar?year=${p.year}&month=${p.month}`;
    nextHref = `/management/calendar?year=${n.year}&month=${n.month}`;
    todayHref = `/management/calendar`;
    const inMonth = today.startsWith(`${year}-${String(month).padStart(2, "0")}`);
    switchHref = `/management/calendar?view=week&start=${inMonth ? today : dates[0]}`;
  }

  const data = await getCalendarRange(dates[0], dates[dates.length - 1]);

  return (
    <main className="max-w-7xl mx-auto p-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-gold text-xs uppercase tracking-[0.3em] mb-2">Management</p>
          <h1 className="text-3xl font-bold text-navy">Calendar</h1>
          <p className="text-text-muted-wabs mt-2" data-testid="calendar-title">{title}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded border border-gray-300 overflow-hidden text-sm mr-2" role="group" aria-label="Calendar view">
            <Link
              href={view.view === "month" ? "#" : switchHref}
              aria-current={view.view === "month" ? "page" : undefined}
              className={`px-3 py-2 ${view.view === "month" ? "bg-navy text-white" : "bg-white text-navy hover:bg-gray-50"}`}
            >
              Month
            </Link>
            <Link
              href={view.view === "week" ? "#" : switchHref}
              aria-current={view.view === "week" ? "page" : undefined}
              className={`px-3 py-2 border-l border-gray-300 ${view.view === "week" ? "bg-navy text-white" : "bg-white text-navy hover:bg-gray-50"}`}
            >
              Week
            </Link>
          </div>
          <Link href={prevHref} className={btn}><ChevronLeft className="w-4 h-4" />Prev</Link>
          <Link href={todayHref} className={btn}>Today</Link>
          <Link href={nextHref} className={btn}>Next<ChevronRight className="w-4 h-4" /></Link>
        </div>
      </div>
      <CalendarGrid dates={dates} data={data} today={today} variant={view.view} />
    </main>
  );
}
