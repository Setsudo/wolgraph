// Server-side category data access (SPEC §5, §6.4). Runs under RLS as the
// signed-in user; every function requires a user. Called from Server
// Components and from the Server Actions in app/(app)/categories/actions.ts.

import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  DUPLICATE_MESSAGE,
  GENERIC_ERROR_MESSAGE,
  nextSortOrder,
  PALETTE,
  restoreMainFirstMessage,
  validateName,
  type ActionResult,
  type ArchiveResult,
  type Category,
} from "./categoryRules";

type Client = Awaited<ReturnType<typeof createClient>>;
type DbError = { code?: string } | null;

const UNIQUE_VIOLATION = "23505";

type Failure = { ok: false; message: string };

async function withUser<R extends ActionResult | ArchiveResult>(
  run: (supabase: Client, userId: string) => Promise<R>,
): Promise<R | Failure> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return fail();
    return await run(supabase, data.user.id);
  } catch {
    return fail();
  }
}

function fail(error?: DbError): Failure {
  return {
    ok: false,
    message: error?.code === UNIQUE_VIOLATION ? DUPLICATE_MESSAGE : GENERIC_ERROR_MESSAGE,
  };
}

// Action arguments come from the client: check types before use.
function isString(value: unknown): value is string {
  return typeof value === "string";
}

function lengthError(name: unknown): ActionResult | null {
  if (!isString(name)) return fail();
  const message = validateName(name);
  return message ? { ok: false, message } : null;
}

/** All of the signed-in user's categories, archived included, in sort order. */
export async function listCategories(): Promise<Category[]> {
  // Per-user data: never prerender (and never touch Supabase env at build time).
  await connection();
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) throw new Error("Not signed in");
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data;
}

export async function addMainCategory(name: string, color: string): Promise<ActionResult> {
  const invalid = lengthError(name);
  if (invalid) return invalid;
  if (!isString(color) || !(PALETTE as readonly string[]).includes(color)) return fail();
  return withUser(async (supabase, userId) => {
    const { data: mains, error: readError } = await supabase
      .from("categories")
      .select("sort_order")
      .is("parent_id", null);
    if (readError) return fail(readError);
    const { error } = await supabase.from("categories").insert({
      user_id: userId,
      name: name.trim(),
      color,
      sort_order: nextSortOrder(mains),
    });
    return error ? fail(error) : { ok: true };
  });
}

export async function addSubCategory(parentId: string, name: string): Promise<ActionResult> {
  const invalid = lengthError(name);
  if (invalid) return invalid;
  if (!isString(parentId)) return fail();
  return withUser(async (supabase, userId) => {
    const { data: parent, error: parentError } = await supabase
      .from("categories")
      .select("color, parent_id")
      .eq("id", parentId)
      .maybeSingle();
    if (parentError || !parent || parent.parent_id !== null) return fail(parentError);
    const { data: siblings, error: readError } = await supabase
      .from("categories")
      .select("sort_order")
      .eq("parent_id", parentId);
    if (readError) return fail(readError);
    const { error } = await supabase.from("categories").insert({
      user_id: userId,
      parent_id: parentId,
      name: name.trim(),
      // Overwritten by the hierarchy trigger; subs inherit the main's color.
      color: parent.color,
      sort_order: nextSortOrder(siblings),
    });
    return error ? fail(error) : { ok: true };
  });
}

export async function renameCategory(id: string, name: string): Promise<ActionResult> {
  const invalid = lengthError(name);
  if (invalid) return invalid;
  if (!isString(id)) return fail();
  return withUser(async (supabase) => {
    const { data, error } = await supabase
      .from("categories")
      .update({ name: name.trim() })
      .eq("id", id)
      .select("id");
    if (error) return fail(error);
    return data.length === 1 ? { ok: true } : fail();
  });
}

/** Archives the category; archiving a main also archives its active subs. Returns the ids archived. */
export async function archiveCategory(id: string): Promise<ArchiveResult> {
  if (!isString(id)) return fail();
  return withUser<ArchiveResult>(async (supabase) => {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("categories")
      .update({ archived_at: now })
      .eq("id", id)
      .is("archived_at", null)
      .select("id, parent_id");
    if (error) return fail(error);
    if (data.length !== 1) return fail();
    const archivedIds = [data[0].id];
    if (data[0].parent_id === null) {
      const { data: subs, error: subsError } = await supabase
        .from("categories")
        .update({ archived_at: now })
        .eq("parent_id", id)
        .is("archived_at", null)
        .select("id");
      if (subsError) return fail(subsError);
      archivedIds.push(...subs.map((sub) => sub.id));
    }
    return { ok: true, archivedIds };
  });
}

/** Restores only this category. A sub whose main is archived is refused. */
export async function restoreCategory(id: string): Promise<ActionResult> {
  if (!isString(id)) return fail();
  return withUser(async (supabase) => {
    const { data: category, error: readError } = await supabase
      .from("categories")
      .select("parent_id")
      .eq("id", id)
      .maybeSingle();
    if (readError || !category) return fail(readError);
    if (category.parent_id !== null) {
      const { data: parent, error: parentError } = await supabase
        .from("categories")
        .select("name, archived_at")
        .eq("id", category.parent_id)
        .maybeSingle();
      if (parentError || !parent) return fail(parentError);
      if (parent.archived_at !== null) {
        return { ok: false, message: restoreMainFirstMessage(parent.name) };
      }
    }
    const { error } = await supabase.from("categories").update({ archived_at: null }).eq("id", id);
    return error ? fail(error) : { ok: true };
  });
}
