import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/data/types";
import { decideRedirect } from "@/lib/auth/routing";
import { getSupabaseEnv } from "./env";

/**
 * Refreshes the Supabase session cookies for this request and applies route protection.
 * Without Supabase env every request is treated as signed out.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });
  let hasUser = false;

  const env = getSupabaseEnv();
  if (env) {
    const supabase = createServerClient<Database>(env.url, env.anonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
        },
      },
    });

    // getClaims() verifies the JWT (and refreshes it if needed); never trust getSession() here.
    const { data } = await supabase.auth.getClaims();
    hasUser = Boolean(data?.claims?.sub);
  }

  const target = decideRedirect(request.nextUrl.pathname, hasUser);
  if (!target) return response;

  const redirect = NextResponse.redirect(new URL(target, request.url));
  // Carry over any refreshed session cookies.
  response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}
