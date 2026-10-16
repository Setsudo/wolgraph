/**
 * Trends screen formatting and URL parsing (SPEC §6.3). Pure functions.
 */

import { periodFor, type Period, type PeriodKind } from "@/lib/data/period";

const SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function parts(day: string): { y: number; m: number; d: number } {
  const [y, m, d] = day.split("-").map(Number);
  return { y, m: m - 1, d };
}

/**
 * "Oct 12 – 18, 2026" (same month), "Sep 28 – Oct 4, 2026" (across months),
 * "Dec 28, 2026 – Jan 3, 2027" (across years), "October 2026" (month).
 */
export function periodLabel(period: Period): string {
  const s = parts(period.start);
  if (period.kind === "month") return `${LONG[s.m]} ${s.y}`;
  const e = parts(period.end);
  if (s.y !== e.y) return `${SHORT[s.m]} ${s.d}, ${s.y} – ${SHORT[e.m]} ${e.d}, ${e.y}`;
  if (s.m !== e.m) return `${SHORT[s.m]} ${s.d} – ${SHORT[e.m]} ${e.d}, ${e.y}`;
  return `${SHORT[s.m]} ${s.d} – ${e.d}, ${e.y}`;
}

/** Hours with at most 2 decimals and no trailing zeros: 12.5 -> "12.5", 3 -> "3". */
export function formatNumber(n: number): string {
  const v = Math.round(n * 100) / 100;
  return String(Object.is(v, -0) ? 0 : v);
}

/** "12.5 h" */
export function formatHours(n: number): string {
  return `${formatNumber(n)} h`;
}

export type TrendsParams = { kind: PeriodKind; anchor: string };
type RawParams = { [key: string]: string | string[] | undefined };

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/** The kind param if valid, else null. */
export function parseKind(raw: RawParams): PeriodKind | null {
  const kind = first(raw.kind);
  return kind === "week" || kind === "month" ? kind : null;
}

/** The anchor param if it is a real YYYY-MM-DD date, else null. */
export function parseAnchor(raw: RawParams): string | null {
  const anchor = first(raw.anchor);
  if (!anchor) return null;
  try {
    periodFor("week", anchor); // throws on a malformed or impossible date
    return anchor;
  } catch {
    return null;
  }
}

/** kind and anchor when both are valid; null means the URL needs canonicalizing. */
export function parseTrendsParams(raw: RawParams): TrendsParams | null {
  const kind = parseKind(raw);
  const anchor = parseAnchor(raw);
  return kind && anchor ? { kind, anchor } : null;
}

/** Builds `${basePath}?...` from current search params with kind and anchor set. */
export function trendsHref(
  basePath: string,
  current: string,
  kind: PeriodKind,
  anchor: string,
): string {
  const params = new URLSearchParams(current);
  params.set("kind", kind);
  params.set("anchor", anchor);
  return `${basePath}?${params.toString()}`;
}
