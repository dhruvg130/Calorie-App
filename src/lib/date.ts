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
