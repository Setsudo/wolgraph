import { redirect } from "next/navigation";
import { addDays } from "@/lib/date";
import { copyableEntries, type CopiedEntry } from "@/lib/day/copy";
import { createClient } from "@/lib/supabase/server";

/** An active category as the day screen needs it. Subcategories carry their main's color. */
export type DayCategory = {
  id: string;
  parentId: string | null;
  name: string;
  color: string;
};

export type DayEntry = {
  categoryId: string;
  hours: number;
  /**
   * The entry's category's main (null for a main). getDay always sets it; the wheel uses it
   * to count archived subcategories' hours toward their main's fill.
   */
  parentId?: string | null;
};

export type DayData = {
  /** Active mains and subs, ordered by sort_order then name. */
  categories: DayCategory[];
  /** Every entry of the day, including those of archived categories. */
  entries: DayEntry[];
  /** The previous day's entries on active categories: what "Copy previous day" would copy. */
  previous: DayEntry[];
};

export type SaveResult = { ok: true } | { ok: false; message: string };

/** Writes one category's hours for a day; 0 deletes the entry. */
export type SaveEntry = (day: string, categoryId: string, hours: number) => Promise<SaveResult>;

export type CopyResult = { ok: true; copied: CopiedEntry[] } | { ok: false; message: string };

/** Copies the previous day's hours onto an empty `day`; never overwrites an existing entry. */
export type CopyPreviousDay = (day: string) => Promise<CopyResult>;

/** The signed-in user's active categories and all entries for `day` (YYYY-MM-DD). Server only. */
export async function getDay(day: string): Promise<DayData> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) redirect(`/login?${new URLSearchParams({ next: `/day/${day}` })}`);

  const [categories, entries, previous] = await Promise.all([
    supabase
      .from("categories")
      .select("id, parent_id, name, color")
      .eq("user_id", userId)
      .is("archived_at", null)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .from("entries")
      .select("category_id, hours, category:categories!entries_category_id_fkey(parent_id)")
      .eq("user_id", userId)
      .eq("day", day),
    supabase
      .from("entries")
      .select("category_id, hours")
      .eq("user_id", userId)
      .eq("day", addDays(day, -1)),
  ]);
  if (categories.error) throw new Error(`Could not load categories: ${categories.error.message}`);
  if (entries.error) throw new Error(`Could not load entries: ${entries.error.message}`);
  if (previous.error) throw new Error(`Could not load entries: ${previous.error.message}`);

  return {
    categories: categories.data.map((c) => ({
      id: c.id,
      parentId: c.parent_id,
      name: c.name,
      color: c.color,
    })),
    entries: entries.data.map((e) => ({
      categoryId: e.category_id,
      hours: Number(e.hours),
      parentId: e.category?.parent_id ?? null,
    })),
    previous: copyableEntries(
      categories.data.map((c) => c.id),
      previous.data.map((e) => ({ categoryId: e.category_id, hours: Number(e.hours) })),
    ),
  };
}
