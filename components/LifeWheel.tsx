import { useId } from "react";
import {
  LIFEWHEEL_RADIUS as R,
  LIFEWHEEL_SIZE as SIZE,
  fitLabels,
  labelArcs,
  ringRadii,
  spokeAngles,
  valueRadii,
} from "@/lib/lifewheel/geometry";
import { polarToXY } from "@/lib/wheel/geometry";
import { LifeWheelPlot } from "./LifeWheelPlot";

const C = SIZE / 2;
export type LifeWheelProps = {
  labels: string[];
  /** One value per label on 0..max; null = no value (no dot, left out of the shape). */
  values: (number | null)[];
  max: number;
  /** Ring values on 0..max; the one equal to max is the boundary circle. */
  rings: number[];
  ringLabel: (v: number) => string;
  ariaLabel: string;
  italic?: boolean[];
  /** Width cap class; defaults to max-w-[560px]. */
  maxWidthClass?: string;
  /** Category colour per label (hex from the data); fills that label's value dot. */
  colors?: string[];
};

/**
 * Reference-style wheel: one equal sector per label, values plotted at the
 * sector centres on a 0..max scale. A null value has no dot and the shape
 * bridges straight past its sector. Static parts render here (server-safe);
 * the shape and dots animate in LifeWheelPlot (client).
 */
export function LifeWheel({
  labels,
  values,
  max,
  rings,
  ringLabel,
  ariaLabel,
  italic,
  maxWidthClass = "max-w-[560px]",
  colors,
}: LifeWheelProps) {
  const idPrefix = useId();
  // Referenced by URL fragment from <textPath href>, so keep it to safe characters.
  const arcId = (i: number) => `${idPrefix}-label-${i}`.replace(/[^A-Za-z0-9_-]/g, "_");

  const n = labels.length;
  // One value per label: missing ones plot at the centre, null ones are left
  // out of the shape, extras are ignored.
  const radii = valueRadii(
    labels.map((_, i) => (values[i] === undefined ? 0 : values[i])),
    max,
    R,
  );
  const ringValues = rings.filter((v) => v > 0);
  const ringR = ringRadii(ringValues, max, R);
  const arcs = labelArcs(n, R);
  const fitted = fitLabels(
    labels.map((l) => l.toUpperCase()),
    arcs.map((a) => a.available),
    italic,
    arcs[0]?.pitch,
  );

  return (
    <LifeWheelPlot
      size={SIZE}
      radii={radii}
      colors={colors}
      ariaLabel={ariaLabel}
      className={`mx-auto block w-full ${maxWidthClass} overflow-visible`}
      defs={arcs.map((a, i) => (
        <path key={i} id={arcId(i)} d={a.d} fill="none" />
      ))}
      grid={
        <g className="fill-none stroke-teal">
          {ringValues.map((v, i) =>
            v < max ? (
              <circle
                key={i}
                data-part="ring"
                cx={C}
                cy={C}
                r={ringR[i]}
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
      }
      overlay={
        <>
          <g className="font-display fill-teal" fontSize={11}>
            {ringValues.map((v, i) => (
              <text key={i} data-part="ring-label" x={C + ringR[i] - 3} y={C + 12} textAnchor="end">
                {ringLabel(v)}
              </text>
            ))}
          </g>
          <g className="font-display fill-navy">
            {fitted.map((fit, i) => (
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
            ))}
          </g>
        </>
      }
    />
  );
}
