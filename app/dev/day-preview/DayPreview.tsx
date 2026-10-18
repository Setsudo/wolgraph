"use client";

import { useState } from "react";
import { DayView } from "@/components/DayView";
import { useLocalToday } from "@/components/useLocalToday";
import type { CopyResult, SaveResult } from "@/lib/data/day";
import { copyableEntries } from "@/lib/day/copy";
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

/** Stands in for copyPreviousDay: "copies" the fixture hours after 300 ms (rejects with ?fail=1). */
function fakeCopy(): Promise<CopyResult> {
  const fail = new URLSearchParams(window.location.search).get("fail") === "1";
  const copied = copyableEntries(
    PREVIEW_CATEGORIES.map((c) => c.id),
    PREVIEW_ENTRIES,
  );
  return new Promise((resolve, reject) =>
    setTimeout(
      () => (fail ? reject(new Error("Simulated failure")) : resolve({ ok: true, copied })),
      300,
    ),
  );
}

/**
 * The real DayView fed fixtures; today has the fixture hours, other days are empty.
 * `subs` swaps in the crowded-subcategory fixtures. `copy`: today starts empty and the
 * fixture hours are the previous day's, so "Copy yesterday's hours" shows.
 */
export function DayPreview({ subs = false, copy = false }: { subs?: boolean; copy?: boolean }) {
  const today = useLocalToday();
  const [day, setDay] = useState<string | null>(null);
  const date = day ?? today;
  if (!date) return <p className="text-navy/60">Loading…</p>;
  return (
    <DayView
      key={date}
      date={date}
      categories={subs ? SUB_PREVIEW_CATEGORIES : PREVIEW_CATEGORIES}
      entries={date === today && !copy ? (subs ? SUB_PREVIEW_ENTRIES : PREVIEW_ENTRIES) : []}
      previous={copy ? PREVIEW_ENTRIES : []}
      save={fakeSave}
      copy={copy ? fakeCopy : undefined}
      onNavigate={setDay}
    />
  );
}
