import { redirect } from "next/navigation";
import type { SaveResult } from "@/lib/data/day";
import { createClient } from "@/lib/supabase/server";

/** An active main category as the rate screen needs it. */
export type RateMain = { id: string; name: string; color: string };

export type RatingsData = {
  /** Active main categories, ordered by sort_order then name. */
  mains: RateMain[];
  /** The day's score per main category id. */
  scores: Record<string, number>;
  /** Per main category id, its most recent score before the day. */
  previous: Record<string, number>;
  /** False when the ratings table is missing (0002_ratings.sql not applied yet). */
  available: boolean;
};

/** Writes one main category's 0-10 score for a day. */
export type SaveRating = (categoryId: string, day: string, score: number) => Promise<SaveResult>;

type DbError = { code?: string; message?: string } | null;

/**
 * True for "the table does not exist": Postgres 42P01, or PostgREST's
 * PGRST205 / "relation ... does not exist" when its schema cache lacks it.
 */
export function isMissingTable(error: DbError): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  return /relation .* does not exist/i.test(error.message ?? "");
}

class MissingTable extends Error {}

/**
 * The signed-in user's active main categories with their scores for `day`
 * (YYYY-MM-DD) and the most recent score before it. Server only. If the
 * ratings table does not exist yet, returns no scores and `available: false`.
 */
export async function getRatings(day: string): Promise<RatingsData> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) redirect(`/login?${new URLSearchParams({ next: "/rate" })}`);

  const categories = await supabase
    .from("categories")
    .select("id, name, color")
    .eq("user_id", userId)
    .is("parent_id", null)
    .is("archived_at", null)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (categories.error) throw new Error(`Could not load categories: ${categories.error.message}`);
  const mains = categories.data.map((c) => ({ id: c.id, name: c.name, color: c.color }));

  const check = (error: DbError, what: string) => {
    if (isMissingTable(error)) throw new MissingTable();
    if (error) throw new Error(`Could not load ${what}: ${error.message}`);
  };

  try {
    const [today, ...before] = await Promise.all([
      supabase.from("ratings").select("category_id, score").eq("user_id", userId).eq("day", day),
      // One indexed lookup per main (primary key user_id, category_id, day).
      ...mains.map((m) =>
        supabase
          .from("ratings")
          .select("score")
          .eq("user_id", userId)
          .eq("category_id", m.id)
          .lt("day", day)
          .order("day", { ascending: false })
          .limit(1),
      ),
    ]);

    check(today.error, "ratings");
    const ids = new Set(mains.map((m) => m.id));
    const scores: Record<string, number> = {};
    for (const r of today.data ?? []) {
      if (ids.has(r.category_id)) scores[r.category_id] = Number(r.score);
    }

    const previous: Record<string, number> = {};
    before.forEach((result, i) => {
      check(result.error, "previous ratings");
      const row = result.data?.[0];
      if (row) previous[mains[i].id] = Number(row.score);
    });

    return { mains, scores, previous, available: true };
  } catch (error) {
    if (error instanceof MissingTable) return { mains, scores: {}, previous: {}, available: false };
    throw error;
  }
}
