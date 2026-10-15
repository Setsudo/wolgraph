"use client";

import { useId, type CSSProperties } from "react";
import { SCORE_MAX, SCORE_MIN } from "@/lib/rate/score";
import type { SaveStatus } from "./HourSheet";

type RatingSliderProps = {
  /** Category name. */
  label: string;
  value: number;
  onChange: (value: number) => void;
  status?: SaveStatus;
  /** Category colour (hex from the data) for the filled track and thumb; teal when absent. */
  color?: string;
};

const TICKS = Array.from({ length: SCORE_MAX - SCORE_MIN + 1 }, (_, i) => SCORE_MIN + i);
const STATUS_TEXT: Record<Exclude<SaveStatus, null>, string> = {
  saving: "Saving…",
  saved: "Saved",
};

/** Horizontal position of the thumb centre for value v (the 22px thumb travels inside the track). */
const at = (v: number) =>
  `calc(11px + (100% - 22px) * ${(v - SCORE_MIN) / (SCORE_MAX - SCORE_MIN)})`;

// Literal class names so Tailwind picks them up. Track and fill are drawn by the divs behind the input.
const INPUT = [
  "relative m-0 block h-[22px] w-full cursor-pointer appearance-none bg-transparent focus:outline-none [--thumb:var(--color-teal)]",
  "[&::-webkit-slider-runnable-track]:h-[22px] [&::-webkit-slider-runnable-track]:bg-transparent",
  "[&::-moz-range-track]:bg-transparent",
  "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:box-border [&::-webkit-slider-thumb]:h-[22px] [&::-webkit-slider-thumb]:w-[22px] [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-[3px] [&::-webkit-slider-thumb]:border-solid [&::-webkit-slider-thumb]:border-cream [&::-webkit-slider-thumb]:bg-[var(--thumb)]",
  "[&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:box-border [&::-moz-range-thumb]:h-[22px] [&::-moz-range-thumb]:w-[22px] [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-[3px] [&::-moz-range-thumb]:border-solid [&::-moz-range-thumb]:border-cream [&::-moz-range-thumb]:bg-[var(--thumb)]",
  "focus-visible:[&::-webkit-slider-thumb]:outline-2 focus-visible:[&::-webkit-slider-thumb]:outline-offset-2 focus-visible:[&::-webkit-slider-thumb]:outline-teal",
  "focus-visible:[&::-moz-range-thumb]:outline-2 focus-visible:[&::-moz-range-thumb]:outline-offset-2 focus-visible:[&::-moz-range-thumb]:outline-teal",
].join(" ");

/** One category's 0-10 rating: native range input, tick numbers and a value box under the thumb. */
export function RatingSlider({ label, value, onChange, status = null, color }: RatingSliderProps) {
  const id = useId();
  return (
    <div className="text-navy">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="font-display text-[18px]">
          {label}
        </label>
        <p role="status" className="text-[12px] text-navy/60">
          {status ? STATUS_TEXT[status] : ""}
        </p>
      </div>
      <div className="relative mt-1 h-[22px]">
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-navy/10"
        />
        <div
          aria-hidden="true"
          data-part="fill"
          className="absolute left-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-teal"
          style={{ width: at(value), backgroundColor: color }}
        />
        <input
          id={id}
          type="range"
          min={SCORE_MIN}
          max={SCORE_MAX}
          step={1}
          value={value}
          aria-label={`${label} rating`}
          aria-valuetext={`${value} out of 10`}
          onChange={(event) => onChange(Number(event.target.value))}
          className={INPUT}
          style={color ? ({ "--thumb": color } as CSSProperties) : undefined}
        />
      </div>
      <div aria-hidden="true" className="relative mt-1 h-[34px]">
        {TICKS.map((t) => (
          <span
            key={t}
            data-part="tick"
            className="absolute top-0 -translate-x-1/2 text-[12px] leading-4 text-navy/60 tabular-nums"
            style={{ left: at(t) }}
          >
            {t}
          </span>
        ))}
        <span
          data-part="value"
          className="absolute -top-1 min-w-7 -translate-x-1/2 rounded border border-navy/10 bg-white px-2 py-2 text-center text-[12px] leading-4 text-navy tabular-nums"
          style={{ left: at(value) }}
        >
          {value}
        </span>
      </div>
    </div>
  );
}
