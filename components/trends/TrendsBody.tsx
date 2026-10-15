import Link from "next/link";
import type { PeriodAggregate } from "@/lib/data/aggregates";
import { Radar } from "@/components/Radar";
import { TotalsTable } from "./TotalsTable";

export const FEW_MAINS_NOTE = "Add at least 3 categories to see the radar.";

/** Radar and totals for a period, or the empty state. Pure render. */
export function TrendsBody({ aggregate }: { aggregate: PeriodAggregate }) {
  if (aggregate.isEmpty) {
    return (
      <div className="py-16 text-center text-navy/70">
        <p>No hours logged this {aggregate.period.kind}.</p>
        <Link href="/" className="mt-2 inline-block text-teal underline underline-offset-4">
          Log today
        </Link>
      </div>
    );
  }

  const showRadar = aggregate.mains.length >= 3;
  return (
    <div className="flex flex-col gap-6">
      {showRadar ? (
        <Radar mains={aggregate.mains} />
      ) : (
        <p className="mx-auto w-full max-w-[440px] text-[13px] text-navy/60">{FEW_MAINS_NOTE}</p>
      )}
      <TotalsTable aggregate={aggregate} />
    </div>
  );
}
