"use client";

import { useId, type KeyboardEvent, type Ref } from "react";
import { arcPath, fillOpacity, polarToXY, RADII } from "@/lib/wheel/geometry";
import { fitLabel, navigate, WHEEL_SIZE, type NavKey, type WheelSegment } from "@/lib/wheel/model";
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
const R = WHEEL_SIZE / 2;
/** Label arcs stop this many degrees short of each segment edge. */
const LABEL_INSET_DEG = 2;
/** Breathing room subtracted from a label arc's length before fitting. */
const LABEL_PAD = 8;
/** How far inward of a sub's name its hours line sits (viewBox units). */
const SUB_HOURS_OFFSET = 14;

type NameLabel = {
  arcId: string;
  arc: string;
  text: string;
  fontSize: number;
  className: string;
};
type HoursLabel = { x: number; y: number; angle: number; text: string; fontSize: number };

/** Where and how big a segment's name and hours go (SPEC §7: names follow the arc). */
function labelLayout(
  s: WheelSegment,
  arcId: string,
): { name: NameLabel | null; hours: HoursLabel | null } {
  const subless = s.ring === "inner" && s.outerR > RADII.inner[1] * R;
  const [nameR, baseSize] =
    s.ring === "outer"
      ? [((RADII.outer[0] + RADII.outer[1]) / 2) * R, 12]
      : subless
        ? [0.8 * R, 14]
        : [((RADII.inner[0] + RADII.inner[1]) / 2) * R, 13];
  const start = s.startAngle + LABEL_INSET_DEG;
  const end = s.endAngle - LABEL_INSET_DEG;
  const mid = (s.startAngle + s.endAngle) / 2;
  const reverse = mid > 90 && mid < 270;
  const available = (nameR * (end - start) * Math.PI) / 180 - LABEL_PAD;
  const label = s.subName ?? s.mainName;
  const fitted = fitLabel(label, available, baseSize);
  const name =
    end > start && fitted.text
      ? {
          arcId,
          arc: arcPath(nameR, start, end, WHEEL_SIZE, reverse),
          text: fitted.text,
          fontSize: fitted.fontSize,
          className: s.ring === "outer" ? "fill-navy/80" : "fill-navy",
        }
      : null;

  // Subs and subless mains show their hours; a main with subs shows only its name.
  let hours: HoursLabel | null = null;
  if (s.fillHours > 0 && (s.ring === "outer" || subless)) {
    const hoursR = subless ? 0.52 * R : nameR - SUB_HOURS_OFFSET;
    const p = polarToXY(hoursR, mid, WHEEL_SIZE);
    hours = {
      x: p.x,
      y: p.y,
      angle: s.labelAngle,
      text: formatHours(s.fillHours),
      fontSize: subless ? 13 : 12,
    };
  }
  return { name, hours };
}

/** Two-ring day wheel (SPEC §7). One tab stop; arrows move between segments. */
export function Wheel({ segments, selectedKey, total, onSelect, onOpen, ref }: WheelProps) {
  const idPrefix = useId();
  const segId = (key: string) => `${idPrefix}-${key}`;
  // Referenced by URL fragment from <textPath href>, so keep it to safe characters.
  const arcId = (key: string) => `${idPrefix}-arc-${key}`.replace(/[^A-Za-z0-9_-]/g, "_");
  const labels = segments.map((s) => ({ key: s.key, ...labelLayout(s, arcId(s.key)) }));
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
      <defs>
        {labels.map(
          ({ key, name }) => name && <path key={key} id={name.arcId} d={name.arc} fill="none" />,
        )}
      </defs>
      <g className="pointer-events-none select-none" aria-hidden="true">
        {labels.map(({ key, name, hours }) => (
          <SegmentLabel key={key} name={name} hours={hours} />
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

function SegmentLabel({ name, hours }: { name: NameLabel | null; hours: HoursLabel | null }) {
  return (
    <>
      {name && (
        <text
          fontSize={name.fontSize}
          textAnchor="middle"
          dominantBaseline="central"
          className={name.className}
        >
          <textPath href={`#${name.arcId}`} startOffset="50%">
            {name.text}
          </textPath>
        </text>
      )}
      {hours && (
        <text
          transform={`translate(${hours.x} ${hours.y}) rotate(${hours.angle})`}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={hours.fontSize}
          className="fill-navy"
        >
          {hours.text}
        </text>
      )}
    </>
  );
}
