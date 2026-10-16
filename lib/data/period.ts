/**
 * Calendar periods for trends (SPEC §6.3). Pure functions.
 *
 * Dates are YYYY-MM-DD strings. All arithmetic runs on UTC Date objects built
 * from those strings, so the local time zone can never shift a day.
 */

export type PeriodKind = "week" | "month";
/** start and end are inclusive. */
export type Period = { kind: PeriodKind; start: string; end: string; days: number };

const DAY_MS = 86_400_000;

function parse(day: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) throw new Error(`Invalid date: ${day}`);
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (Number.isNaN(d.getTime()) || d.getUTCDate() !== Number(m[3])) {
    throw new Error(`Invalid date: ${day}`);
  }
  return d;
}

function format(d: Date): string {
  const y = String(d.getUTCFullYear()).padStart(4, "0");
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY_MS);
}

function make(kind: PeriodKind, start: Date, end: Date): Period {
  const days = Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1;
  return { kind, start: format(start), end: format(end), days };
}

/** Week = Monday..Sunday containing anchor; month = the calendar month containing anchor. */
export function periodFor(kind: PeriodKind, anchor: string): Period {
  const d = parse(anchor);
  if (kind === "week") {
    const offset = (d.getUTCDay() + 6) % 7; // Monday = 0 ... Sunday = 6
    const start = addDays(d, -offset);
    return make("week", start, addDays(start, 6));
  }
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  return make("month", new Date(Date.UTC(y, m, 1)), new Date(Date.UTC(y, m + 1, 0)));
}

/** The period delta steps away: +1 next, -1 previous. */
export function shiftPeriod(p: Period, delta: number): Period {
  const start = parse(p.start);
  if (p.kind === "week") return periodFor("week", format(addDays(start, 7 * delta)));
  const shifted = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + delta, 1));
  return periodFor("month", format(shifted));
}

/** Every day of the period, start to end, as YYYY-MM-DD. */
export function eachDay(p: Period): string[] {
  const start = parse(p.start);
  return Array.from({ length: p.days }, (_, i) => format(addDays(start, i)));
}
