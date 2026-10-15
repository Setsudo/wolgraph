"use client";

import { useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { periodFor, shiftPeriod, type PeriodKind } from "@/lib/data/period";
import { todayLocal } from "@/lib/date";
import { periodLabel, trendsHref } from "@/lib/trends/format";

const noopSubscribe = () => () => {};

/** Browser-local today; null during server render and hydration. */
function useToday(): string | null {
  return useSyncExternalStore(noopSubscribe, todayLocal, () => null);
}

const KINDS: { kind: PeriodKind; label: string }[] = [
  { kind: "week", label: "Week" },
  { kind: "month", label: "Month" },
];

/** Week/Month toggle and previous/next period arrows. */
export function PeriodControls({
  kind,
  anchor,
  basePath,
}: {
  kind: PeriodKind;
  anchor: string;
  basePath: string;
}) {
  const router = useRouter();
  const today = useToday();
  const period = periodFor(kind, anchor);
  const atLatest = today === null || period.end >= today;

  function go(nextKind: PeriodKind, nextAnchor: string) {
    router.push(trendsHref(basePath, window.location.search, nextKind, nextAnchor));
  }

  return (
    <div className="mx-auto flex w-full max-w-[440px] flex-col items-center gap-3">
      <div role="group" aria-label="Period length" className="flex rounded-lg border border-teal">
        {KINDS.map(({ kind: k, label }) => {
          const selected = k === kind;
          return (
            <button
              key={k}
              type="button"
              aria-pressed={selected}
              onClick={() => !selected && go(k, anchor)}
              className={`h-9 px-5 text-sm first:rounded-l-[7px] last:rounded-r-[7px] ${
                selected ? "bg-teal text-cream" : "text-navy"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
      <div className="flex w-full items-center justify-between">
        <button
          type="button"
          aria-label={`Previous ${kind}`}
          onClick={() => go(kind, shiftPeriod(period, -1).start)}
          className="flex size-11 items-center justify-center rounded-lg text-2xl text-navy"
        >
          ‹
        </button>
        <h2 className="font-display text-xl text-navy" aria-live="polite">
          {periodLabel(period)}
        </h2>
        <button
          type="button"
          aria-label={`Next ${kind}`}
          disabled={atLatest}
          onClick={() => go(kind, shiftPeriod(period, 1).start)}
          className="flex size-11 items-center justify-center rounded-lg text-2xl text-navy disabled:opacity-30"
        >
          ›
        </button>
      </div>
    </div>
  );
}
