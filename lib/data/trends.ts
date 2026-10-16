import { createClient } from "@/lib/supabase/server";
import { aggregatePeriod } from "./aggregates";
import type { Period } from "./period";
import { withRatings, type TrendAggregate } from "./ratingAggregates";
import { isMissingTable } from "./ratings";

/**
 * Trend data for the signed-in user (RLS scopes rows to them): every category,
 * archived included, and the entries and ratings inside the period, aggregated.
 * A missing ratings table means no ratings and `ratingsAvailable: false`.
 */
export async function getTrendData(period: Period): Promise<TrendAggregate> {
  const supabase = await createClient();
  const [categories, entries, ratings] = await Promise.all([
    supabase.from("categories").select("*"),
    supabase.from("entries").select("*").gte("day", period.start).lte("day", period.end),
    supabase
      .from("ratings")
      .select("category_id, day, score")
      .gte("day", period.start)
      .lte("day", period.end),
  ]);
  if (categories.error) throw categories.error;
  if (entries.error) throw entries.error;
  const ratingsMissing = isMissingTable(ratings.error);
  if (ratings.error && !ratingsMissing) throw ratings.error;
  return withRatings(
    aggregatePeriod(categories.data, entries.data, period),
    ratingsMissing ? [] : (ratings.data ?? []),
    !ratingsMissing,
  );
}
