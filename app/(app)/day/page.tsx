"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { todayLocal } from "@/lib/date";

/** Sends /day to today's day page, using the browser's local date (servers run in UTC). */
export default function DayIndex() {
  const router = useRouter();

  useEffect(() => {
    router.replace(`/day/${todayLocal()}`);
  }, [router]);

  return <p className="text-navy/60">Loading…</p>;
}
