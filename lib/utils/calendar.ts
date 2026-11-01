// Return [1, 2, ..., daysInMonth] for the given year/month.
export function daysInMonth(year: number, month: number): number[] {
  const lastDay = new Date(year, month, 0).getDate();
  return Array.from({ length: lastDay }, (_, i) => i + 1);
}

// Given a block spanning [start_date, end_date] (ISO strings) and a target month
// (year/month, month 1-12), return { startDay, endDay } clamped to that month.
// Returns null if the block does not intersect this month.
export function clampBlockToMonth(
  startDate: string,
  endDate: string,
  year: number,
  month: number
): { startDay: number; endDay: number } | null {
  const lastDay = new Date(year, month, 0).getDate();

  // Parse dates as local YYYY-MM-DD components to avoid timezone shifts
  const [bsy, bsm, bsd] = startDate.split("-").map(Number);
  const [bey, bem, bed] = endDate.split("-").map(Number);

  // Month start: year/month/1, month end: year/month/lastDay
  // Compare using numeric year/month/day to stay timezone-safe
  const blockStartBeforeMonthEnd =
    bsy < year || (bsy === year && (bsm < month || (bsm === month && bsd <= lastDay)));
  const blockEndAfterMonthStart =
    bey > year || (bey === year && (bem > month || (bem === month && bed >= 1)));

  if (!blockStartBeforeMonthEnd || !blockEndAfterMonthStart) return null;

  // Clamp startDay
  let startDay: number;
  if (bsy < year || (bsy === year && bsm < month)) {
    startDay = 1;
  } else {
    startDay = bsd;
  }

  // Clamp endDay
  let endDay: number;
  if (bey > year || (bey === year && bem > month)) {
    endDay = lastDay;
  } else {
    endDay = bed;
  }

  return { startDay, endDay };
}

// Return the previous (year, month) for nav links. Handles year rollover.
export function prevMonth(year: number, month: number): { year: number; month: number } {
  if (month === 1) {
    return { year: year - 1, month: 12 };
  }
  return { year, month: month - 1 };
}

// Return the next (year, month) for nav links. Handles year rollover.
export function nextMonth(year: number, month: number): { year: number; month: number } {
  if (month === 12) {
    return { year: year + 1, month: 1 };
  }
  return { year, month: month + 1 };
}

// e.g. "October 2026"
export function formatMonth(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
}

// ---------- Range-based helpers (month + week views) ----------

const pad = (n: number) => String(n).padStart(2, "0");

export function isoDate(y: number, m: number, d: number): string {
  return `${y}-${pad(m)}-${pad(d)}`;
}

// Add days to a YYYY-MM-DD string in UTC (no local-timezone drift).
export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return isoDate(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

// Monday of the ISO week containing `iso`.
export function startOfWeek(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sun
  return addDays(iso, dow === 0 ? -6 : 1 - dow);
}

export function dateRange(startIso: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => addDays(startIso, i));
}

export function monthDates(year: number, month: number): string[] {
  return daysInMonth(year, month).map(d => isoDate(year, month, d));
}

// Column span (1-based, inclusive) of a [start, end] block inside `dates`.
// Returns null when the block doesn't intersect the visible range.
export function blockColumns(start: string, end: string, dates: string[]): { from: number; to: number } | null {
  if (dates.length === 0) return null;
  const first = dates[0];
  const last = dates[dates.length - 1];
  if (end < first || start > last) return null;
  const from = start <= first ? 1 : dates.indexOf(start) + 1;
  const to = end >= last ? dates.length : dates.indexOf(end) + 1;
  return from > 0 && to > 0 ? { from, to } : null;
}

export type ConflictBlock = { id: string; vehicle_id: string; start_date: string; end_date: string; type: string };

// IDs of blocks that overlap another block on the same vehicle.
// The DB exclusion constraint only covers booking + maintenance, so overlaps
// involving 'blocked' periods (or legacy data) can exist; surface them.
export function findConflicts(blocks: ConflictBlock[]): Set<string> {
  const out = new Set<string>();
  const byVehicle = new Map<string, ConflictBlock[]>();
  for (const b of blocks) byVehicle.set(b.vehicle_id, [...(byVehicle.get(b.vehicle_id) ?? []), b]);
  for (const list of Array.from(byVehicle.values())) {
    const sorted = [...list].sort((a, b) => a.start_date.localeCompare(b.start_date));
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length && sorted[j].start_date <= sorted[i].end_date; j++) {
        out.add(sorted[i].id);
        out.add(sorted[j].id);
      }
    }
  }
  return out;
}

export function formatWeek(startIso: string): string {
  const end = addDays(startIso, 6);
  const fmt = (iso: string, withYear: boolean) =>
    new Date(iso + "T00:00:00Z").toLocaleString("en-US", {
      month: "short", day: "numeric", ...(withYear ? { year: "numeric" } : {}), timeZone: "UTC",
    });
  return `${fmt(startIso, false)} – ${fmt(end, true)}`;
}
