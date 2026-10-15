/** Formats a date as YYYY-MM-DD using its local (not UTC) calendar day. */
export function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Today's date as YYYY-MM-DD in the server's local time zone. */
export function todayLocal(now: Date = new Date()): string {
  return toLocalDateString(now);
}

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseDay(day: string): Date | null {
  const m = DAY_RE.exec(day);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (d.getUTCFullYear() !== Number(m[1]) || d.getUTCMonth() !== Number(m[2]) - 1) return null;
  if (d.getUTCDate() !== Number(m[3])) return null;
  return d;
}

/** True for a real calendar date written as YYYY-MM-DD. */
export function isValidDay(day: unknown): day is string {
  return typeof day === "string" && parseDay(day) !== null;
}

/** The YYYY-MM-DD date n days after day (n may be negative). Time-zone independent. */
export function addDays(day: string, n: number): string {
  const d = parseDay(day);
  if (!d) throw new Error(`Invalid date: ${day}`);
  d.setUTCDate(d.getUTCDate() + n);
  const y = String(d.getUTCFullYear()).padStart(4, "0");
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/** Short label such as "Tue, Oct 14" for a YYYY-MM-DD date. */
export function formatDayLabel(day: string): string {
  const d = parseDay(day);
  if (!d) throw new Error(`Invalid date: ${day}`);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/**
 * The latest calendar day any time zone can be on at `now`: UTC today + 1
 * (the furthest-ahead zone, UTC+14, is never more than one day ahead of UTC).
 * The server cannot know the browser's zone, so it rejects only days after this.
 */
export function latestDayAnywhere(now: Date = new Date()): string {
  return addDays(now.toISOString().slice(0, 10), 1);
}
