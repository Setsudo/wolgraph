import type { PeriodAggregate } from "@/lib/data/aggregates";
import { formatHours } from "@/lib/trends/format";

/** Per-category total and per-day average for the period. */
export function TotalsTable({ aggregate }: { aggregate: PeriodAggregate }) {
  return (
    <table className="mx-auto w-full max-w-[440px] border-collapse text-sm text-navy">
      <thead>
        <tr className="text-xs tracking-wide text-navy/60 uppercase">
          <th scope="col" className="py-2 text-left font-normal">
            Category
          </th>
          <th scope="col" className="py-2 text-right font-normal">
            Total
          </th>
          <th scope="col" className="py-2 text-right font-normal">
            Avg / day
          </th>
        </tr>
      </thead>
      <tbody>
        {aggregate.mains.map((m) => (
          <tr key={m.mainId} className="border-t border-navy/10">
            <th scope="row" className="py-2 text-left font-normal">
              <span className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="inline-block size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: m.color }}
                />
                <span className={m.archived ? "italic" : undefined}>
                  {m.archived ? `${m.name} (archived)` : m.name}
                </span>
              </span>
            </th>
            <td className="py-2 text-right tabular-nums">{formatHours(m.total)}</td>
            <td className="py-2 text-right tabular-nums">{formatHours(m.average)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="border-t border-navy/10">
          <td colSpan={3} className="pt-2 text-xs text-navy/60">
            Days logged: {aggregate.daysWithEntries} of {aggregate.period.days}
          </td>
        </tr>
      </tfoot>
    </table>
  );
}
