/**
 * Trend aggregation (SPEC §6.3). Pure functions, no Supabase.
 *
 * Totals per main category for a period, with subcategory hours rolled into
 * their main; the per-day average divides by the days in the period that have
 * any entry with hours > 0.
 */

import type { Period } from "./period";
import type { CategoryRow, EntryRow } from "./types";

export type MainAggregate = {
  mainId: string;
  name: string;
  color: string;
  archived: boolean;
  total: number;
  average: number;
};
export type PeriodAggregate = {
  period: Period;
  daysWithEntries: number;
  mains: MainAggregate[];
  isEmpty: boolean;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export function aggregatePeriod(
  categories: CategoryRow[],
  entries: EntryRow[],
  period: Period,
): PeriodAggregate {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const totals = new Map<string, number>();
  const days = new Set<string>();

  for (const e of entries) {
    if (e.day < period.start || e.day > period.end) continue; // YYYY-MM-DD sorts lexically
    const cat = byId.get(e.category_id);
    if (!cat) continue;
    const mainId = cat.parent_id ?? cat.id;
    const main = byId.get(mainId);
    if (!main || main.parent_id !== null) continue; // orphaned or malformed sub
    const hours = Number(e.hours);
    if (!(hours > 0)) continue;
    totals.set(mainId, (totals.get(mainId) ?? 0) + hours);
    days.add(e.day);
  }

  const daysWithEntries = days.size;
  const mains = categories
    .filter((c) => c.parent_id === null)
    .filter((c) => c.archived_at === null || (totals.get(c.id) ?? 0) > 0)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
    .map((c): MainAggregate => {
      const total = totals.get(c.id) ?? 0;
      return {
        mainId: c.id,
        name: c.name,
        color: c.color,
        archived: c.archived_at !== null,
        total: round2(total),
        average: daysWithEntries > 0 ? round2(total / daysWithEntries) : 0,
      };
    });

  return { period, daysWithEntries, mains, isEmpty: daysWithEntries === 0 };
}
