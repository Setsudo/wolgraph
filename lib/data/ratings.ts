import { redirect } from "next/navigation";
import type { SaveResult } from "@/lib/data/day";
import { createClient } from "@/lib/supabase/server";

/** An active main category as the rate screen needs it. */
export type RateMain = { id: string; name: string; color: string };

/** The most recent earlier day with any ratings: shown faintly behind today's shape, never saved. */
export type RatingsGhost = { day: string; scores: Record<string, number> };

export type RatingsData = {
  /** Active main categories, ordered by sort_order then name. */
  mains: RateMain[];
  /** The day's score per main category id. */
  scores: Record<string, number>;
  /**
   * The latest day before `day` with any rating rows, with its scores for active mains.
   * Display only: never a slider's value. null when there is none or the table is missing.
   */
  ghost: RatingsGhost | null;
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
 * (YYYY-MM-DD), plus the latest earlier rated day as `ghost`. Server only. If the
 * ratings table does not exist yet, returns no scores, no ghost and `available: false`.
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

  const ids = new Set(mains.map((m) => m.id));
  const activeScores = (rows: { category_id: string; score: number }[] | null) => {
    const out: Record<string, number> = {};
    for (const r of rows ?? []) if (ids.has(r.category_id)) out[r.category_id] = Number(r.score);
    return out;
  };

  try {
    const [today, latest] = await Promise.all([
      supabase.from("ratings").select("category_id, score").eq("user_id", userId).eq("day", day),
      // The most recent earlier day with any rating rows (the ghost's day).
      supabase
        .from("ratings")
        .select("day")
        .eq("user_id", userId)
        .lt("day", day)
        .order("day", { ascending: false })
        .limit(1),
    ]);
    check(today.error, "ratings");
    check(latest.error, "earlier ratings");
    const scores = activeScores(today.data);

    const ghostDay = latest.data?.[0]?.day;
    let ghost: RatingsGhost | null = null;
    if (ghostDay) {
      const rows = await supabase
        .from("ratings")
        .select("category_id, score")
        .eq("user_id", userId)
        .eq("day", ghostDay);
      check(rows.error, "earlier ratings");
      const ghostScores = activeScores(rows.data);
      // Only archived categories rated that day: nothing to outline, so no caption either.
      if (Object.keys(ghostScores).length > 0) ghost = { day: ghostDay, scores: ghostScores };
    }

    return { mains, scores, ghost, available: true };
  } catch (error) {
    if (error instanceof MissingTable) return { mains, scores: {}, ghost: null, available: false };
    throw error;
  }
}
