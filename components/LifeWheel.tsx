import { useId } from "react";
import {
  LIFEWHEEL_RADIUS as R,
  LIFEWHEEL_SIZE as SIZE,
  labelArcs,
  points,
  ringRadii,
  spokeAngles,
} from "@/lib/lifewheel/geometry";
import { polygonPath } from "@/lib/radar/geometry";
import { polarToXY } from "@/lib/wheel/geometry";
import { fitLabel } from "@/lib/wheel/model";

const C = SIZE / 2;
const LABEL_BASE_SIZE = 17;
const LABEL_MIN_SIZE = 10;
/**
 * fitLabel assumes mixed-case glyphs (0.56 em); uppercase serif with 0.06em
 * tracking runs about 0.76 em per character, and text past the end of a
 * textPath is not drawn, so fit against a proportionally shorter length.
 */
const CAPS_FIT = 0.73;

export type LifeWheelProps = {
  labels: string[];
  values: number[];
  max: number;
  /** Ring values on 0..max; the one equal to max is the boundary circle. */
  rings: number[];
  ringLabel: (v: number) => string;
  ariaLabel: string;
  italic?: boolean[];
};

/**
 * Reference-style wheel: one equal sector per label, values plotted at the
 * sector centres on a 0..max scale. Pure SVG render.
 */
export function LifeWheel({
  labels,
  values,
  max,
  rings,
  ringLabel,
  ariaLabel,
  italic,
}: LifeWheelProps) {
  const idPrefix = useId();
  // Referenced by URL fragment from <textPath href>, so keep it to safe characters.
  const arcId = (i: number) => `${idPrefix}-label-${i}`.replace(/[^A-Za-z0-9_-]/g, "_");

  const n = labels.length;
  // One value per label: missing ones plot at the centre, extras are ignored.
  const data = points(
    labels.map((_, i) => values[i] ?? 0),
    max,
    R,
  );
  const ringValues = rings.filter((v) => v > 0);
  const radii = ringRadii(ringValues, max, R);
  const arcs = labelArcs(n, R);

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      role="img"
      aria-label={ariaLabel}
      className="mx-auto block w-full max-w-[560px] overflow-visible"
    >
      <defs>
        {arcs.map((a, i) => (
          <path key={i} id={arcId(i)} d={a.d} fill="none" />
        ))}
      </defs>
      <g data-part="data-layer">
        <path
          data-part="data"
          d={polygonPath(data)}
          className="fill-teal stroke-teal"
          fillOpacity={0.4}
          strokeWidth={2}
          strokeLinejoin="round"
        />
        {data.map((p, i) => (
          <circle key={i} data-part="dot" cx={p.x} cy={p.y} r={4} className="fill-teal" />
        ))}
      </g>
      <g className="fill-none stroke-teal">
        {ringValues.map((v, i) =>
          v < max ? (
            <circle
              key={i}
              data-part="ring"
              cx={C}
              cy={C}
              r={radii[i]}
              strokeWidth={1}
              strokeOpacity={0.7}
            />
          ) : null,
        )}
        {spokeAngles(n).map((a) => {
          const end = polarToXY(R, a, SIZE);
          return (
            <line key={a} data-part="spoke" x1={C} y1={C} x2={end.x} y2={end.y} strokeWidth={1} />
          );
        })}
        <circle data-part="boundary" cx={C} cy={C} r={R} strokeWidth={2.5} />
      </g>
      <g className="fill-teal" fontSize={11}>
        {ringValues.map((v, i) => (
          <text key={i} data-part="ring-label" x={C + radii[i] - 3} y={C + 12} textAnchor="end">
            {ringLabel(v)}
          </text>
        ))}
      </g>
      <g className="font-display fill-navy">
        {arcs.map((a, i) => {
          const fit = fitLabel(
            labels[i].toUpperCase(),
            a.available * CAPS_FIT,
            LABEL_BASE_SIZE,
            LABEL_MIN_SIZE,
          );
          return (
            <text
              key={i}
              data-part="label"
              fontSize={fit.fontSize}
              letterSpacing="0.06em"
              textAnchor="middle"
              dominantBaseline="central"
              fontStyle={italic?.[i] ? "italic" : undefined}
            >
              <textPath href={`#${arcId(i)}`} startOffset="50%">
                {fit.text}
              </textPath>
            </text>
          );
        })}
      </g>
    </svg>
  );
}
