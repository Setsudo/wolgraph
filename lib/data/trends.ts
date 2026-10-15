import { createClient } from "@/lib/supabase/server";
import { aggregatePeriod, type PeriodAggregate } from "./aggregates";
import type { Period } from "./period";

/**
 * Trend data for the signed-in user (RLS scopes rows to them): every category,
 * archived included, and the entries inside the period, aggregated.
 */
export async function getTrendData(period: Period): Promise<PeriodAggregate> {
  const supabase = await createClient();
  const [categories, entries] = await Promise.all([
    supabase.from("categories").select("*"),
    supabase.from("entries").select("*").gte("day", period.start).lte("day", period.end),
  ]);
  if (categories.error) throw categories.error;
  if (entries.error) throw entries.error;
  return aggregatePeriod(categories.data, entries.data, period);
}
