import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/data/types";
import { requireSupabaseEnv } from "./env";

/** Supabase client for Client Components. Throws "Supabase is not configured" when env is missing. */
export function createClient() {
  const { url, anonKey } = requireSupabaseEnv();
  return createBrowserClient<Database>(url, anonKey);
}
