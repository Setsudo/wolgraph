import { NextResponse, type NextRequest } from "next/server";
import { sanitizeNext } from "@/lib/auth/routing";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

/** Magic-link landing: exchanges the PKCE code for a session, then goes to `next`. */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const next = sanitizeNext(searchParams.get("next"));

  if (code && getSupabaseEnv()) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, request.url));
  }

  return NextResponse.redirect(new URL("/login", request.url));
}
