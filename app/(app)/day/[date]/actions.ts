"use server";

import { revalidatePath } from "next/cache";
import type { CopyResult, SaveResult } from "@/lib/data/day";
import { addDays, isValidDay, latestDayAnywhere } from "@/lib/date";
import { copyableEntries } from "@/lib/day/copy";
import { isValidHours } from "@/lib/hours";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FAILED: SaveResult = { ok: false, message: "Couldn't save." };

/**
 * Sets the signed-in user's hours for one category on one day: 0 deletes the
 * entry, anything else upserts it. Days after the latest date any time zone
 * can be on are rejected.
 */
export async function saveEntry(
  day: string,
  categoryId: string,
  hours: number,
): Promise<SaveResult> {
  if (!isValidDay(day)) return { ok: false, message: "Invalid date." };
  if (day > latestDayAnywhere(new Date())) {
    return { ok: false, message: "Future days can't be edited." };
  }
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
    if (error) return FAILED;
    // Drop cached copies of this day (client router cache included) so a later visit,
    // back/forward too, reads fresh entries. The current route re-renders in this
    // response; DayView merges it without touching categories with unsettled edits.
    revalidatePath(`/day/${day}`);
    return { ok: true };
  } catch {
    return FAILED;
  }
}

const COPY_FAILED: CopyResult = { ok: false, message: "Couldn't copy." };

/**
 * Copies the signed-in user's hours from the day before `day` onto `day`, for active
 * categories only. Runs only on an explicit tap; existing entries on `day` are never
 * overwritten (insert, conflicts ignored). Returns the entries actually written.
 */
export async function copyPreviousDay(day: string): Promise<CopyResult> {
  if (!isValidDay(day)) return { ok: false, message: "Invalid date." };
  if (day > latestDayAnywhere(new Date())) {
    return { ok: false, message: "Future days can't be edited." };
  }

  try {
    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getClaims();
    const userId = auth?.claims?.sub;
    if (!userId) return { ok: false, message: "Not signed in." };

    const [categories, previous] = await Promise.all([
      supabase.from("categories").select("id").eq("user_id", userId).is("archived_at", null),
      supabase
        .from("entries")
        .select("category_id, hours")
        .eq("user_id", userId)
        .eq("day", addDays(day, -1)),
    ]);
    if (categories.error || previous.error) return COPY_FAILED;

    const rows = copyableEntries(
      categories.data.map((c) => c.id),
      previous.data.map((e) => ({ categoryId: e.category_id, hours: Number(e.hours) })),
    );
    if (rows.length === 0) return { ok: true, copied: [] };

    const { data, error } = await supabase
      .from("entries")
      .upsert(
        rows.map((r) => ({ user_id: userId, category_id: r.categoryId, day, hours: r.hours })),
        { onConflict: "user_id,category_id,day", ignoreDuplicates: true },
      )
      .select("category_id, hours");
    if (error) return COPY_FAILED;
    revalidatePath(`/day/${day}`);
    return {
      ok: true,
      copied: (data ?? []).map((e) => ({ categoryId: e.category_id, hours: Number(e.hours) })),
    };
  } catch {
    return COPY_FAILED;
  }
}
