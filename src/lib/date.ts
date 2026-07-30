/**
 * "Today" is defined in the device's local timezone, while `consumed_at` is
 * stored as `timestamptz` (UTC) in Postgres. These helpers convert a local
 * calendar day into the UTC instant range to filter on, so a meal logged at
 * 11pm stays on the day the user actually ate it.
 */

export function startOfLocalDay(date: Date = new Date()): Date {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}

export function startOfNextLocalDay(date: Date = new Date()): Date {
  const next = startOfLocalDay(date);
  next.setDate(next.getDate() + 1);
  return next;
}

/** Half-open [from, to) range covering the given local day, as ISO instants. */
export function localDayRange(date: Date = new Date()): { from: string; to: string } {
  return {
    from: startOfLocalDay(date).toISOString(),
    to: startOfNextLocalDay(date).toISOString(),
  };
}

/** Stable key for cache scoping — `2026-07-28` in local time, not UTC. */
export function localDayKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatDayHeading(date: Date = new Date()): string {
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// Calendar navigation
//
// All arithmetic goes through Date's own setDate/setMonth, which handle month
// lengths, leap years and DST transitions correctly. Adding 24h in
// milliseconds does not — it silently shifts by an hour across a DST boundary.
// ---------------------------------------------------------------------------

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  // Anchor to the 1st first: setMonth on the 31st would roll "Jan 31 + 1
  // month" forward into March.
  next.setDate(1);
  next.setMonth(next.getMonth() + months);
  return next;
}

/** Sunday-first, matching the iOS calendar default. */
export function startOfWeek(date: Date): Date {
  const start = startOfLocalDay(date);
  start.setDate(start.getDate() - start.getDay());
  return start;
}

export function startOfMonth(date: Date): Date {
  const start = startOfLocalDay(date);
  start.setDate(1);
  return start;
}

export function isSameDay(a: Date, b: Date): boolean {
  return localDayKey(a) === localDayKey(b);
}

export function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

/** Future days can hold no entries, so they are not selectable. */
export function isFutureDay(date: Date): boolean {
  return startOfLocalDay(date).getTime() > startOfLocalDay(new Date()).getTime();
}

export function weekDays(anchor: Date): Date[] {
  const start = startOfWeek(anchor);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/**
 * Six rows of seven, always — a fixed height stops the layout jumping as the
 * user pages between months of different shapes.
 */
export function monthGrid(anchor: Date): Date[] {
  const gridStart = startOfWeek(startOfMonth(anchor));
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
}

/** Half-open [from, to) covering every day in the list, as ISO instants. */
export function rangeForDays(days: Date[]): { from: string; to: string } {
  const times = days.map((d) => startOfLocalDay(d).getTime());
  const first = new Date(Math.min(...times));
  const last = new Date(Math.max(...times));
  return { from: first.toISOString(), to: startOfNextLocalDay(last).toISOString() };
}

export function formatMonthYear(date: Date): string {
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

/** "Today" / "Yesterday" read better than a date for the two most common days. */
export function formatRelativeDay(date: Date): string {
  if (isToday(date)) return 'Today';
  if (isSameDay(date, addDays(new Date(), -1))) return 'Yesterday';
  return date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

/**
 * The calendar day of `day` combined with the clock time of `time`.
 *
 * Used for back-dated entries: logging at 3pm for yesterday should store
 * yesterday 3pm, not yesterday midnight, so it sorts naturally among that
 * day's other entries.
 */
export function withTimeOfDay(day: Date, time: Date): Date {
  const result = startOfLocalDay(day);
  result.setHours(time.getHours(), time.getMinutes(), time.getSeconds(), 0);
  return result;
}
