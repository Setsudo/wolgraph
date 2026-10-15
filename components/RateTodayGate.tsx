"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { isValidDay } from "@/lib/date";
import { useLocalToday } from "./useLocalToday";

/**
 * Today and earlier days can be rated; the browser-local today is what the server
 * cannot know. Renders children for a valid `day` up to that today (or before
 * hydration). A missing or invalid day, or one after the local today, replaces
 * the URL with /rate?day=<local today>.
 */
export function RateTodayGate({ day, children }: { day: string | null; children?: ReactNode }) {
  const router = useRouter();
  const today = useLocalToday();
  const valid = day !== null && isValidDay(day);
  const redirect = today !== null && (!valid || day > today);

  useEffect(() => {
    if (redirect) router.replace(`/rate?day=${today}`);
  }, [router, redirect, today]);

  return !valid || redirect ? <p className="text-navy/60">Loading…</p> : children;
}
