import Link from "next/link";
import type { TrendAggregate, TrendMain } from "@/lib/data/ratingAggregates";
import { LifeWheel } from "@/components/LifeWheel";
import { ringSteps, scaleMax } from "@/lib/radar/geometry";
import { formatNumber } from "@/lib/trends/format";
import { TotalsTable } from "./TotalsTable";

export const FEW_MAINS_NOTE = "Add at least 3 categories to see the wheel.";
export const TIME_HEADING = "Time · avg hours per day";
export const RATING_HEADING = "Rating · avg score 0-10";
export const NO_RATINGS = "No ratings in this period.";
export const RATINGS_UNAVAILABLE = "Ratings aren't set up yet.";

const RATING_MAX = 10;
const RATING_RINGS = [2, 4, 6, 8, 10];

/** Wheels of average hours and ratings, totals, or the empty state. Pure render. */
export function TrendsBody({ aggregate }: { aggregate: TrendAggregate }) {
  if (aggregate.isEmpty) {
    return (
      <div className="py-16 text-center text-navy/70">
        <p>No hours logged this {aggregate.period.kind}.</p>
        <Link href="/day" className="mt-2 inline-block text-teal underline underline-offset-4">
          Log today
        </Link>
      </div>
    );
  }

  const showWheel = aggregate.mains.length >= 3;
  return (
    <div className="flex flex-col gap-6">
      {showWheel ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <section className="flex flex-col gap-2">
            <ChartHeading>{TIME_HEADING}</ChartHeading>
            <AverageWheel mains={aggregate.mains} />
          </section>
          <section className="flex flex-col gap-2">
            <ChartHeading>{RATING_HEADING}</ChartHeading>
            {aggregate.ratingsEmpty ? (
              <p className="py-16 text-center text-sm text-navy/60">
                {aggregate.ratingsAvailable ? NO_RATINGS : RATINGS_UNAVAILABLE}
              </p>
            ) : (
              <RatingWheel mains={aggregate.mains} />
            )}
          </section>
        </div>
      ) : (
        <p className="mx-auto w-full max-w-[440px] text-[13px] text-navy/60">{FEW_MAINS_NOTE}</p>
      )}
      <TotalsTable aggregate={aggregate} />
    </div>
  );
}

/** Small chart caption, in the Trends table-header style. */
function ChartHeading({ children }: { children: string }) {
  return (
    <h3 className="text-center text-xs font-normal tracking-wide text-navy/60 uppercase">
      {children}
    </h3>
  );
}

const wheelLabels = (mains: TrendMain[]) =>
  mains.map((m) => (m.archived ? `${m.name} (archived)` : m.name));

/** Average hours per day, one sector per main category. */
function AverageWheel({ mains }: { mains: TrendMain[] }) {
  const values = mains.map((m) => m.average);
  const max = scaleMax(values);
  return (
    <LifeWheel
      labels={wheelLabels(mains)}
      italic={mains.map((m) => m.archived)}
      colors={mains.map((m) => m.color)}
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

/** Average 0-10 rating, same sectors and colours; unrated mains sit at the centre. */
function RatingWheel({ mains }: { mains: TrendMain[] }) {
  return (
    <LifeWheel
      labels={wheelLabels(mains)}
      italic={mains.map((m) => m.archived)}
      colors={mains.map((m) => m.color)}
      values={mains.map((m) => m.averageRating ?? 0)}
      max={RATING_MAX}
      rings={RATING_RINGS}
      ringLabel={(v) => `${v}`}
      ariaLabel={
        "Average rating out of 10: " +
        mains
          .map((m) => `${m.name} ${m.averageRating === null ? "n/a" : m.averageRating.toFixed(1)}`)
          .join(", ")
      }
    />
  );
}
