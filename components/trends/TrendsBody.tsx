import Link from "next/link";
import type { MainAggregate, PeriodAggregate } from "@/lib/data/aggregates";
import { LifeWheel } from "@/components/LifeWheel";
import { ringSteps, scaleMax } from "@/lib/radar/geometry";
import { formatNumber } from "@/lib/trends/format";
import { TotalsTable } from "./TotalsTable";

export const FEW_MAINS_NOTE = "Add at least 3 categories to see the wheel.";

/** Wheel of averages and totals for a period, or the empty state. Pure render. */
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

  const showWheel = aggregate.mains.length >= 3;
  return (
    <div className="flex flex-col gap-6">
      {showWheel ? (
        <AverageWheel mains={aggregate.mains} />
      ) : (
        <p className="mx-auto w-full max-w-[440px] text-[13px] text-navy/60">{FEW_MAINS_NOTE}</p>
      )}
      <TotalsTable aggregate={aggregate} />
    </div>
  );
}

/** Average hours per day, one sector per main category. */
function AverageWheel({ mains }: { mains: MainAggregate[] }) {
  const values = mains.map((m) => m.average);
  const max = scaleMax(values);
  return (
    <LifeWheel
      labels={mains.map((m) => (m.archived ? `${m.name} (archived)` : m.name))}
      italic={mains.map((m) => m.archived)}
      values={values}
      max={max}
      rings={ringSteps(max)}
      ringLabel={(v) => `${v}h`}
      ariaLabel={
        "Average hours per day: " +
        mains.map((m) => `${m.name} ${formatNumber(m.average)}`).join(", ")
      }
    />
  );
}
