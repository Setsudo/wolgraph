"use client";

import { RateView } from "@/components/RateView";
import { useLocalToday } from "@/components/useLocalToday";
import type { SaveResult } from "@/lib/data/day";
import { PREVIEW_MAINS, PREVIEW_SCORES } from "./fixtures";

/** Stands in for saveRating: resolves after 200 ms, or rejects when the URL has ?fail=1. */
function fakeSave(): Promise<SaveResult> {
  const fail = new URLSearchParams(window.location.search).get("fail") === "1";
  return new Promise((resolve, reject) =>
    setTimeout(() => (fail ? reject(new Error("Simulated failure")) : resolve({ ok: true })), 200),
  );
}

/** The real RateView fed fixtures for today; `unavailable` mimics a missing ratings table. */
export function RatePreview({ unavailable }: { unavailable: boolean }) {
  const today = useLocalToday();
  if (!today) return <p className="text-navy/60">Loading…</p>;
  return (
    <RateView
      day={today}
      mains={PREVIEW_MAINS}
      scores={unavailable ? {} : PREVIEW_SCORES}
      available={!unavailable}
      save={fakeSave}
    />
  );
}
