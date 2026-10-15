import type { MainAggregate } from "@/lib/data/aggregates";
import {
  axisAngles,
  labelPosition,
  polygonPath,
  radarPoints,
  ringLabelPosition,
  ringPath,
  ringSteps,
  scaleMax,
  type RadarOptions,
} from "@/lib/radar/geometry";
import { polarToXY } from "@/lib/wheel/geometry";
import { formatNumber } from "@/lib/trends/format";

const SIZE = 400;
const CENTER = SIZE / 2;
/** Room around the web for axis labels. */
const OPTS: RadarOptions = { size: SIZE, padding: 72 };
const RADIUS = SIZE / 2 - (OPTS.padding ?? 0);
/** Vertical room above and below the web for the top and bottom axis labels. */
const LABEL_BAND = 36;
/** Cropped to the web plus label bands; horizontally 0..SIZE (side labels may overflow). */
const RADAR_VIEWBOX = `0 ${CENTER - RADIUS - LABEL_BAND} ${SIZE} ${2 * RADIUS + 2 * LABEL_BAND}`;

/** Radar of average hours per day, one axis per main category. Pure render. */
export function Radar({ mains }: { mains: MainAggregate[] }) {
  const n = mains.length;
  const values = mains.map((m) => m.average);
  const max = scaleMax(values);
  const rings = ringSteps(max);
  const points = radarPoints(values, max, OPTS);
  const label =
    "Average hours per day: " + mains.map((m) => `${m.name} ${formatNumber(m.average)}`).join(", ");

  return (
    <svg
      viewBox={RADAR_VIEWBOX}
      role="img"
      aria-label={label}
      className="mx-auto block w-full max-w-[520px] overflow-visible"
    >
      <g className="fill-none stroke-navy/15" strokeWidth={1}>
        {rings.map((v) => (
          <path key={v} data-part="ring" d={ringPath(n, v, max, OPTS)} />
        ))}
        {axisAngles(n).map((a, i) => {
          const end = polarToXY(RADIUS, a, SIZE);
          return <line key={i} data-part="axis" x1={CENTER} y1={CENTER} x2={end.x} y2={end.y} />;
        })}
      </g>
      <g className="fill-navy/50" fontSize={10}>
        {rings.map((v) => {
          const pos = ringLabelPosition(v, max, n, OPTS);
          return (
            <text
              key={v}
              data-part="ring-label"
              x={pos.x}
              y={pos.y}
              textAnchor="start"
              dominantBaseline="middle"
            >
              {`${v}h`}
            </text>
          );
        })}
      </g>
      <path
        data-part="data"
        d={polygonPath(points)}
        className="fill-teal/25 stroke-teal"
        strokeWidth={2}
        strokeLinejoin="round"
      />
      {points.map((p, i) => (
        <circle
          key={mains[i].mainId}
          data-part="dot"
          cx={p.x}
          cy={p.y}
          r={4}
          fill={mains[i].color}
        />
      ))}
      <g className="fill-navy" fontSize={12}>
        {mains.map((m, i) => {
          const pos = labelPosition(i, n, OPTS);
          const dy = pos.y - CENTER;
          const baseline = dy < -RADIUS * 0.5 ? "auto" : dy > RADIUS * 0.5 ? "hanging" : "middle";
          return (
            <text
              key={m.mainId}
              data-part="label"
              x={pos.x}
              y={pos.y}
              textAnchor={pos.anchor}
              dominantBaseline={baseline}
              fontStyle={m.archived ? "italic" : undefined}
            >
              {m.archived ? `${m.name} (archived)` : m.name}
            </text>
          );
        })}
      </g>
    </svg>
  );
}
