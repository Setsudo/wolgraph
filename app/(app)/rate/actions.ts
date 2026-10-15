"use server";

import { revalidatePath } from "next/cache";
import type { SaveResult } from "@/lib/data/day";
import { isValidDay, latestDayAnywhere } from "@/lib/date";
import { isValidScore } from "@/lib/rate/score";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FAILED: SaveResult = { ok: false, message: "Couldn't save." };

/**
 * Sets the signed-in user's 0-10 score for one main category on one day
 * (upsert). Days after the latest date any time zone can be on are rejected;
 * the database rejects sub-categories.
 */
export async function saveRating(
  categoryId: string,
  day: string,
  score: number,
): Promise<SaveResult> {
  if (typeof categoryId !== "string" || !UUID.test(categoryId)) {
    return { ok: false, message: "Invalid category." };
  }
  if (!isValidDay(day)) return { ok: false, message: "Invalid date." };
  if (day > latestDayAnywhere(new Date())) {
    return { ok: false, message: "Future days can't be edited." };
  }
  if (!isValidScore(score)) return { ok: false, message: "Score must be a whole number 0 to 10." };

  try {
    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getClaims();
    const userId = auth?.claims?.sub;
    if (!userId) return { ok: false, message: "Not signed in." };

    const { error } = await supabase
      .from("ratings")
      .upsert(
        { user_id: userId, category_id: categoryId, day, score },
        { onConflict: "user_id,category_id,day" },
      );
    if (error) return FAILED;
    revalidatePath("/rate");
    return { ok: true };
  } catch {
    return FAILED;
  }
}
