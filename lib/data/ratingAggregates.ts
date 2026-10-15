/**
 * Rating aggregation for Trends (BACKLOG item 9). Pure functions, no Supabase.
 *
 * Adds each main category's average 0-10 rating for the period to the hours
 * aggregate, keeping its list and order (so archived mains follow the hours
 * inclusion rule). Only rated days count: an unrated day is excluded, not 0.
 */

import type { MainAggregate, PeriodAggregate } from "./aggregates";
import type { RatingRow } from "./types";

export type RatingInput = Pick<RatingRow, "category_id" | "day" | "score">;

export type TrendMain = MainAggregate & {
  /** Mean score over the period's rated days, 1 decimal; null when unrated. */
  averageRating: number | null;
};

export type TrendAggregate = Omit<PeriodAggregate, "mains"> & {
  mains: TrendMain[];
  /** No rating rows at all inside the period. */
  ratingsEmpty: boolean;
  /** False when the ratings table is missing (0002_ratings.sql not applied). */
  ratingsAvailable: boolean;
};

const round1 = (n: number) => Math.round(n * 10) / 10;

export function withRatings(
  aggregate: PeriodAggregate,
  ratings: RatingInput[],
  ratingsAvailable = true,
): TrendAggregate {
  const { start, end } = aggregate.period;
  // Score per category per day; a repeated (category, day) counts once, last wins.
  const byMain = new Map<string, Map<string, number>>();
  let inPeriod = 0;

  for (const r of ratings) {
    if (r.day < start || r.day > end) continue; // YYYY-MM-DD sorts lexically
    const score = Number(r.score);
    if (!Number.isFinite(score)) continue;
    inPeriod++;
    let days = byMain.get(r.category_id);
    if (!days) byMain.set(r.category_id, (days = new Map()));
    days.set(r.day, score);
  }

  const mains = aggregate.mains.map((m): TrendMain => {
    const days = byMain.get(m.mainId);
    if (!days || days.size === 0) return { ...m, averageRating: null };
    let sum = 0;
    for (const s of days.values()) sum += s;
    return { ...m, averageRating: round1(sum / days.size) };
  });

  return { ...aggregate, mains, ratingsEmpty: inPeriod === 0, ratingsAvailable };
}
