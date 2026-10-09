// Return { startISO, endISO } where startISO is the first moment of the current
// UTC month and endISO is the exclusive upper bound (first moment of next month).
// Both are UTC midnight. Pass `now` explicitly so tests can inject a known date.
export function currentMonthRangeUTC(now: Date = new Date()): { startISO: string; endISO: string } {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth(); // 0-based

  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 1)); // JS Date handles month=12 → next year

  return {
    startISO: start.toISOString(),
    endISO: end.toISOString(),
  };
}

// Return the YYYY-MM-DD date string for "today" in UTC.
export function todayUTC(now: Date = new Date()): string {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
