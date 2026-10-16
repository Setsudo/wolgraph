"use client";

import { useState } from "react";
import { DayView } from "@/components/DayView";
import { useLocalToday } from "@/components/useLocalToday";
import type { SaveResult } from "@/lib/data/day";
import {
  PREVIEW_CATEGORIES,
  PREVIEW_ENTRIES,
  SUB_PREVIEW_CATEGORIES,
  SUB_PREVIEW_ENTRIES,
} from "./fixtures";

/** Stands in for saveEntry: resolves after 200 ms, or rejects when the URL has ?fail=1. */
function fakeSave(): Promise<SaveResult> {
  const fail = new URLSearchParams(window.location.search).get("fail") === "1";
  return new Promise((resolve, reject) =>
    setTimeout(() => (fail ? reject(new Error("Simulated failure")) : resolve({ ok: true })), 200),
  );
}

/**
 * The real DayView fed fixtures; today has the fixture hours, other days are empty.
 * `subs` swaps in the crowded-subcategory fixtures.
 */
export function DayPreview({ subs = false }: { subs?: boolean }) {
  const today = useLocalToday();
  const [day, setDay] = useState<string | null>(null);
  const date = day ?? today;
  if (!date) return <p className="text-navy/60">Loading…</p>;
  return (
    <DayView
      key={date}
      date={date}
      categories={subs ? SUB_PREVIEW_CATEGORIES : PREVIEW_CATEGORIES}
      entries={date === today ? (subs ? SUB_PREVIEW_ENTRIES : PREVIEW_ENTRIES) : []}
      save={fakeSave}
      onNavigate={setDay}
    />
  );
}
