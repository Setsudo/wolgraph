"use server";

import type { SaveResult } from "@/lib/data/day";
import { isValidDay } from "@/lib/date";
import { isValidHours } from "@/lib/hours";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FAILED: SaveResult = { ok: false, message: "Couldn't save." };

/**
 * Sets the signed-in user's hours for one category on one day: 0 deletes the
 * entry, anything else upserts it. Does not revalidate; the client owns the
 * optimistic state.
 */
export async function saveEntry(
  day: string,
  categoryId: string,
  hours: number,
): Promise<SaveResult> {
  if (!isValidDay(day)) return { ok: false, message: "Invalid date." };
  if (typeof categoryId !== "string" || !UUID.test(categoryId)) {
    return { ok: false, message: "Invalid category." };
  }
  if (!isValidHours(hours)) return { ok: false, message: "Hours must be 0 to 24 in 0.25 steps." };

  try {
    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getClaims();
    const userId = auth?.claims?.sub;
    if (!userId) return { ok: false, message: "Not signed in." };

    const { error } =
      hours === 0
        ? await supabase
            .from("entries")
            .delete()
            .eq("user_id", userId)
            .eq("category_id", categoryId)
            .eq("day", day)
        : await supabase
            .from("entries")
            .upsert(
              { user_id: userId, category_id: categoryId, day, hours },
              { onConflict: "user_id,category_id,day" },
            );
    return error ? FAILED : { ok: true };
  } catch {
    return FAILED;
  }
}
