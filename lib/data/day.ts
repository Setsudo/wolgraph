import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** An active category as the day screen needs it. Subcategories carry their main's color. */
export type DayCategory = {
  id: string;
  parentId: string | null;
  name: string;
  color: string;
};

export type DayEntry = { categoryId: string; hours: number };

export type DayData = {
  /** Active mains and subs, ordered by sort_order then name. */
  categories: DayCategory[];
  /** Every entry of the day, including those of archived categories. */
  entries: DayEntry[];
};

export type SaveResult = { ok: true } | { ok: false; message: string };

/** Writes one category's hours for a day; 0 deletes the entry. */
export type SaveEntry = (day: string, categoryId: string, hours: number) => Promise<SaveResult>;

/** The signed-in user's active categories and all entries for `day` (YYYY-MM-DD). Server only. */
export async function getDay(day: string): Promise<DayData> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) redirect(`/login?${new URLSearchParams({ next: `/day/${day}` })}`);

  const [categories, entries] = await Promise.all([
    supabase
      .from("categories")
      .select("id, parent_id, name, color")
      .eq("user_id", userId)
      .is("archived_at", null)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    supabase.from("entries").select("category_id, hours").eq("user_id", userId).eq("day", day),
  ]);
  if (categories.error) throw new Error(`Could not load categories: ${categories.error.message}`);
  if (entries.error) throw new Error(`Could not load entries: ${entries.error.message}`);

  return {
    categories: categories.data.map((c) => ({
      id: c.id,
      parentId: c.parent_id,
      name: c.name,
      color: c.color,
    })),
    entries: entries.data.map((e) => ({ categoryId: e.category_id, hours: Number(e.hours) })),
  };
}
