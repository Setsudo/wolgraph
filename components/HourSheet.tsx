"use client";

import type { ReactNode, Ref } from "react";
import { addHours, formatHours, formatHoursFixed, HOURS_STEP, QUICK_ADD } from "@/lib/hours";

export type SaveStatus = "saving" | "saved" | null;

/** One row of a main with subs: "General" (the main's own hours) or an active sub. */
export type SheetRow = { id: string; name: string; hours: number; status: SaveStatus };

type HourSheetProps = {
  /** null when no segment is selected. */
  title: string | null;
  /** The single stepper's value (no rows). */
  hours: number;
  /**
   * A main with active subs: General first, then each sub. Absent or null for a
   * subless main, which keeps the single stepper.
   */
  rows?: SheetRow[] | null;
  /** Main own + active subs + archived subs, shown as "Total {h} h" with rows. */
  total?: number;
  /** Row id that quick add and Clear target (default: the first row, General). */
  activeId?: string | null;
  onActivate?: (id: string) => void;
  onRowChange?: (id: string, hours: number) => void;
  /** Below 768px: whether the bottom sheet is shown. At 768px and up the panel is always shown. */
  open: boolean;
  readOnly: boolean;
  /** Show the "Future days can't be edited." note. */
  future: boolean;
  /** Save status of the single stepper (rows show their own). */
  status: SaveStatus;
  /** Single stepper, quick add and Clear without rows. */
  onChange: (hours: number) => void;
  onClose: () => void;
  /** Positioned against the sheet, e.g. a toast that must sit above it. */
  overlay?: ReactNode;
  ref?: Ref<HTMLElement>;
};

const STATUS_TEXT: Record<Exclude<SaveStatus, null>, string> = {
  saving: "Saving…",
  saved: "Saved",
};

/**
 * Hours stepper for one category, or one row per category for a main with subs:
 * bottom sheet on phones, side card from 768px.
 */
export function HourSheet({
  title,
  hours,
  rows = null,
  total = 0,
  activeId = null,
  onActivate = () => {},
  onRowChange = () => {},
  open,
  readOnly,
  future,
  status,
  onChange,
  onClose,
  overlay,
  ref,
}: HourSheetProps) {
  const shown = open && title !== null;
  const hasRows = title !== null && rows !== null && rows.length > 0;
  const active = hasRows ? (rows.find((r) => r.id === activeId) ?? rows[0]) : null;
  /** Quick add and Clear: the active row with rows, else the single value. */
  const current = active ? active.hours : hours;
  const setCurrent = (value: number) => (active ? onRowChange(active.id, value) : onChange(value));
  return (
    <section
      ref={ref}
      aria-label="Hours"
      className={`${hasRows ? "flex max-h-[75vh] flex-col md:max-h-screen " : ""}fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-[520px] rounded-t-2xl bg-cream p-5 shadow-[0_-4px_24px_color-mix(in_srgb,var(--color-navy)_15%,transparent)] transition-[translate,visibility] duration-150 md:visible md:static md:z-auto md:mx-0 md:w-[300px] md:shrink-0 md:translate-none md:rounded-xl md:border md:border-navy/10 md:bg-white/60 md:p-6 md:shadow-none md:transition-none ${
        shown ? "visible translate-y-0" : "invisible translate-y-full"
      }`}
    >
      {title === null ? (
        // Only reachable from 768px: below that the sheet is hidden while nothing is selected.
        <p data-testid="hours-placeholder" className="hidden text-[15px] text-navy/60 md:block">
          Tap a category to log hours.
        </p>
      ) : (
        <div className={hasRows ? "flex min-h-0 flex-1 flex-col text-navy" : "text-navy"}>
          <div className="flex items-start justify-between gap-2">
            <h2 className="font-display text-[20px]">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="-mt-2 -mr-2 h-11 min-w-11 px-2 text-teal md:hidden"
            >
              Done
            </button>
          </div>

          {hasRows ? (
            <>
              <p className="text-[14px] text-navy/60">Total {formatHours(total)} h</p>
              <ul className="mt-3 min-h-0 flex-1 overflow-y-auto">
                {rows.map((row) => (
                  <li
                    key={row.id}
                    data-testid="hours-row"
                    data-active={row.id === active?.id ? "true" : undefined}
                    onClick={() => onActivate(row.id)}
                    className={`flex items-center justify-between gap-2 border-b border-navy/10 px-2 py-1.5 last:border-b-0 ${
                      row.id === active?.id ? "rounded-lg bg-teal/10" : ""
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-display text-[16px]">{row.name}</p>
                      <p role="status" className="min-h-[16px] text-[12px] text-navy/60">
                        {row.status ? STATUS_TEXT[row.status] : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        aria-label={`Decrease ${row.name} by ${HOURS_STEP} hours`}
                        disabled={readOnly}
                        onClick={() => onRowChange(row.id, addHours(row.hours, -HOURS_STEP))}
                        className="h-11 w-11 rounded-xl border border-navy/30 text-[20px] disabled:opacity-40"
                      >
                        −
                      </button>
                      <span className="text-[16px] tabular-nums">
                        {formatHoursFixed(row.hours)} h
                      </span>
                      <button
                        type="button"
                        aria-label={`Increase ${row.name} by ${HOURS_STEP} hours`}
                        disabled={readOnly}
                        onClick={() => onRowChange(row.id, addHours(row.hours, HOURS_STEP))}
                        className="h-11 w-11 rounded-xl border border-navy/30 text-[20px] disabled:opacity-40"
                      >
                        +
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <div className="mt-4 flex items-center justify-between">
              <button
                type="button"
                aria-label={`Decrease by ${HOURS_STEP} hours`}
                disabled={readOnly}
                onClick={() => onChange(addHours(hours, -HOURS_STEP))}
                className="h-12 w-12 rounded-xl border border-navy/30 text-[24px] disabled:opacity-40"
              >
                −
              </button>
              <span aria-live="polite" className="text-[28px] tabular-nums">
                {formatHoursFixed(hours)} h
              </span>
              <button
                type="button"
                aria-label={`Increase by ${HOURS_STEP} hours`}
                disabled={readOnly}
                onClick={() => onChange(addHours(hours, HOURS_STEP))}
                className="h-12 w-12 rounded-xl border border-navy/30 text-[24px] disabled:opacity-40"
              >
                +
              </button>
            </div>
          )}

          <p className="mt-4 text-[12px] text-navy/60">
            {active ? `Quick add to ${active.name}` : "Quick add"}
          </p>
          <div className="mt-1 flex flex-wrap gap-2 md:gap-1.5">
            {QUICK_ADD.map((chip) => (
              <button
                key={chip}
                type="button"
                aria-label={`Add ${chip} hours`}
                disabled={readOnly}
                onClick={() => setCurrent(addHours(current, chip))}
                className="h-9 rounded-full bg-teal/15 px-3 text-teal md:px-2.5 disabled:opacity-40"
              >
                +{chip}
              </button>
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between">
            {/* With rows, each row shows its own status; this keeps Clear on the right. */}
            <p
              role={active ? undefined : "status"}
              className="min-h-[18px] text-[12px] text-navy/60"
            >
              {!active && status ? STATUS_TEXT[status] : ""}
            </p>
            <button
              type="button"
              disabled={readOnly}
              onClick={() => setCurrent(0)}
              className="h-11 px-2 text-amber disabled:opacity-40"
            >
              Clear
            </button>
          </div>

          {future && (
            <p className="mt-2 text-[12px] text-navy/60">Future days can&apos;t be edited.</p>
          )}
        </div>
      )}
      {overlay}
    </section>
  );
}
