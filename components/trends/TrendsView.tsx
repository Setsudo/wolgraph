import type { PeriodAggregate } from "@/lib/data/aggregates";
import { PeriodControls } from "./PeriodControls";
import { TrendsBody } from "./TrendsBody";

/** The whole trends screen for one period; shared by /trends and the dev preview. */
export function TrendsView({
  aggregate,
  anchor,
  basePath,
}: {
  aggregate: PeriodAggregate;
  anchor: string;
  basePath: string;
}) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="sr-only">Trends</h1>
      <PeriodControls kind={aggregate.period.kind} anchor={anchor} basePath={basePath} />
      <TrendsBody aggregate={aggregate} />
    </div>
  );
}
