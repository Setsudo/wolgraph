export type SupabaseEnv = { url: string; anonKey: string };

/**
 * Supabase URL and anon key, or null when either is missing.
 * The literal `process.env.NEXT_PUBLIC_*` reads let Next inline them into client code.
 */
export function getSupabaseEnv(): SupabaseEnv | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

export const SUPABASE_NOT_CONFIGURED = "Supabase is not configured";

export function requireSupabaseEnv(): SupabaseEnv {
  const env = getSupabaseEnv();
  if (!env) throw new Error(SUPABASE_NOT_CONFIGURED);
  return env;
}
