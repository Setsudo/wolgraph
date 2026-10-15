"use client";

import { useId, type KeyboardEvent, type Ref } from "react";
import { fillOpacity } from "@/lib/wheel/geometry";
import { navigate, truncate, WHEEL_SIZE, type NavKey, type WheelSegment } from "@/lib/wheel/model";
import { formatHours } from "@/lib/hours";

type WheelProps = {
  segments: WheelSegment[];
  selectedKey: string | null;
  /** Sum of every entry that day. */
  total: number;
  /** Arrow keys moved the selection. */
  onSelect: (key: string) => void;
  /** A click, Enter or Space on a segment: select it and open the sheet. */
  onOpen: (key: string) => void;
  ref?: Ref<SVGSVGElement>;
};

const NAV_KEYS = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]);
const C = WHEEL_SIZE / 2;

/** Two-ring day wheel (SPEC §7). One tab stop; arrows move between segments. */
export function Wheel({ segments, selectedKey, total, onSelect, onOpen, ref }: WheelProps) {
  const idPrefix = useId();
  const segId = (key: string) => `${idPrefix}-${key}`;
  const selected = segments.find((s) => s.key === selectedKey) ?? null;
  const over = total > 24;

  function handleKeyDown(event: KeyboardEvent<SVGSVGElement>) {
    if (NAV_KEYS.has(event.key)) {
      event.preventDefault();
      const next = navigate(segments, selectedKey, event.key as NavKey);
      if (next) onSelect(next);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const key = selected?.key ?? segments[0]?.key;
      if (key) onOpen(key);
    }
  }

  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${WHEEL_SIZE} ${WHEEL_SIZE}`}
      role="group"
      aria-label="Day wheel"
      aria-activedescendant={selected ? segId(selected.key) : undefined}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="mx-auto block w-full max-w-[520px] md:max-w-[600px] rounded-full outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-4 focus-visible:outline-teal"
    >
      {segments.map((s) => (
        <path
          key={s.key}
          id={segId(s.key)}
          d={s.path}
          role="button"
          tabIndex={-1}
          aria-label={s.ariaLabel}
          fill={s.color}
          fillOpacity={fillOpacity(s.fillHours)}
          stroke={s.color}
          strokeWidth={1.5}
          className="cursor-pointer outline-none"
          onClick={(event) => {
            // Keep focus on the group, the wheel's single tab stop.
            event.currentTarget.ownerSVGElement?.focus();
            onOpen(s.key);
          }}
        />
      ))}
      {selected && (
        <path
          d={selected.path}
          fill="none"
          strokeWidth={2.5}
          className="pointer-events-none stroke-navy"
          aria-hidden="true"
          data-testid="selection"
        />
      )}
      <g className="pointer-events-none select-none" aria-hidden="true">
        {segments.map((s) => (
          <SegmentLabel key={s.key} segment={s} />
        ))}
        <text
          x={C}
          y={C + 4}
          textAnchor="middle"
          className={`font-display ${over ? "fill-amber" : "fill-navy"}`}
          fontSize={28}
        >
          {formatHours(total)} h
        </text>
        <text
          x={C}
          y={C + 24}
          textAnchor="middle"
          className={over ? "fill-amber" : "fill-navy/60"}
          fontSize={13}
        >
          {over ? "over 24" : "of 24"}
        </text>
      </g>
    </svg>
  );
}

function SegmentLabel({ segment: s }: { segment: WheelSegment }) {
  const transform = `translate(${s.labelPoint.x} ${s.labelPoint.y}) rotate(${s.labelAngle})`;
  const hours = s.fillHours > 0 ? formatHours(s.fillHours) : null;

  if (s.ring === "inner") {
    return (
      <text
        transform={transform}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={13}
        className="fill-navy"
      >
        {truncate(s.mainName, 12)}
      </text>
    );
  }
  const wide = s.endAngle - s.startAngle >= 20;
  if (s.subName !== null && wide) {
    return (
      <text transform={transform} textAnchor="middle" dominantBaseline="central" fontSize={12}>
        <tspan x={0} dy={hours ? "-0.6em" : 0} className="fill-navy/80">
          {truncate(s.subName, 8)}
        </tspan>
        {hours && (
          <tspan x={0} dy="1.2em" className="fill-navy">
            {hours}
          </tspan>
        )}
      </text>
    );
  }
  if (!hours) return null;
  return (
    <text
      transform={transform}
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={12}
      className="fill-navy"
    >
      {hours}
    </text>
  );
}
