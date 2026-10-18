/** "Copy previous day" rules (backlog 12): what an explicit tap copies onto an empty day. Pure. */

import type { DayCategory, DayEntry } from "@/lib/data/day";
import { addDays, formatDayLabel } from "@/lib/date";
import { formatHours, isValidHours } from "@/lib/hours";

export type CopiedEntry = { categoryId: string; hours: number };

/**
 * The previous day's entries worth copying: active categories only (archived ones have
 * left the wheel), positive valid hours, at most one per category.
 */
export function copyableEntries(
  activeIds: Iterable<string>,
  previous: readonly CopiedEntry[],
): CopiedEntry[] {
  const active = new Set(activeIds);
  const seen = new Set<string>();
  const out: CopiedEntry[] = [];
  for (const e of previous) {
    if (!active.has(e.categoryId) || seen.has(e.categoryId)) continue;
    if (!(e.hours > 0) || !isValidHours(e.hours)) continue;
    seen.add(e.categoryId);
    out.push({ categoryId: e.categoryId, hours: e.hours });
  }
  return out;
}

/** copyableEntries for the day screen's categories. */
export function copyPlan(categories: readonly DayCategory[], previous: readonly DayEntry[]) {
  const entries = copyableEntries(
    categories.map((c) => c.id),
    previous,
  );
  return { entries, total: entries.reduce((sum, e) => sum + e.hours, 0) };
}

/**
 * The copy action is offered only on an editable day with nothing logged and nothing waiting
 * to save, so it can never overwrite an hour the user entered.
 */
export function canOfferCopy(opts: {
  readOnly: boolean;
  dayTotal: number;
  unsettled: boolean;
  copyable: number;
}): boolean {
  return !opts.readOnly && opts.dayTotal === 0 && !opts.unsettled && opts.copyable > 0;
}

/** "yesterday" when `date` is today, otherwise the previous day's short label. */
export function previousDayName(date: string, today: string | null): string {
  return date === today ? "yesterday" : formatDayLabel(addDays(date, -1));
}

/** Button text, e.g. "Copy yesterday's hours (17.5 h)" or "Copy hours from Thu, Oct 15 (2 h)". */
export function copyLabel(date: string, today: string | null, total: number): string {
  const from = previousDayName(date, today);
  const what = from === "yesterday" ? "Copy yesterday's hours" : `Copy hours from ${from}`;
  return `${what} (${formatHours(total)} h)`;
}

/** Confirmation after a copy, e.g. "Copied 6 entries from yesterday." */
export function copiedMessage(count: number, from: string): string {
  if (count === 0) return "Nothing new to copy.";
  return `Copied ${count} ${count === 1 ? "entry" : "entries"} from ${from}.`;
}
