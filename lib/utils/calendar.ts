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
