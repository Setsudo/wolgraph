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
