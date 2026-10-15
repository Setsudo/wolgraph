"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useLocalToday } from "./useLocalToday";

/**
 * The rate screen rates the browser-local today, which the server cannot know.
 * Renders children while `day` matches it (or before hydration), otherwise
 * replaces the URL with /rate?day=<local today>.
 */
export function RateTodayGate({ day, children }: { day: string | null; children?: ReactNode }) {
  const router = useRouter();
  const today = useLocalToday();
  const stale = day === null || (today !== null && today !== day);

  useEffect(() => {
    if (today !== null && today !== day) router.replace(`/rate?day=${today}`);
  }, [router, today, day]);

  return stale ? <p className="text-navy/60">Loading…</p> : children;
}
