"use client";

import type { ReactNode, Ref } from "react";
import { addHours, formatHoursFixed, HOURS_STEP, QUICK_ADD } from "@/lib/hours";

export type SaveStatus = "saving" | "saved" | null;

type HourSheetProps = {
  /** null when no segment is selected. */
  title: string | null;
  hours: number;
  /** Below 768px: whether the bottom sheet is shown. At 768px and up the panel is always shown. */
  open: boolean;
  readOnly: boolean;
  /** Show the "Future days can't be edited." note. */
  future: boolean;
  status: SaveStatus;
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

/** Hours stepper for one category: bottom sheet on phones, side card from 768px. */
export function HourSheet({
  title,
  hours,
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
  return (
    <section
      ref={ref}
      aria-label="Hours"
      className={`fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-[520px] rounded-t-2xl bg-cream p-5 shadow-[0_-4px_24px_color-mix(in_srgb,var(--color-navy)_15%,transparent)] transition-[translate,visibility] duration-150 md:visible md:static md:z-auto md:mx-0 md:w-[300px] md:shrink-0 md:translate-none md:rounded-xl md:border md:border-navy/10 md:bg-white/60 md:p-6 md:shadow-none md:transition-none ${
        shown ? "visible translate-y-0" : "invisible translate-y-full"
      }`}
    >
      {title === null ? (
        // Only reachable from 768px: below that the sheet is hidden while nothing is selected.
        <p data-testid="hours-placeholder" className="hidden text-[15px] text-navy/60 md:block">
          Tap a category to log hours.
        </p>
      ) : (
        <div className="text-navy">
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

          <p className="mt-4 text-[12px] text-navy/60">Quick add</p>
          <div className="mt-1 flex flex-wrap gap-2 md:gap-1.5">
            {QUICK_ADD.map((chip) => (
              <button
                key={chip}
                type="button"
                aria-label={`Add ${chip} hours`}
                disabled={readOnly}
                onClick={() => onChange(addHours(hours, chip))}
                className="h-9 rounded-full bg-teal/15 px-3 text-teal md:px-2.5 disabled:opacity-40"
              >
                +{chip}
              </button>
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between">
            <p role="status" className="min-h-[18px] text-[12px] text-navy/60">
              {status ? STATUS_TEXT[status] : ""}
            </p>
            <button
              type="button"
              disabled={readOnly}
              onClick={() => onChange(0)}
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
