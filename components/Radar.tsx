import type { MainAggregate } from "@/lib/data/aggregates";
import {
  axisAngles,
  labelPosition,
  polygonPath,
  radarPoints,
  ringPath,
  ringSteps,
  scaleMax,
  type RadarOptions,
} from "@/lib/radar/geometry";
import { polarToXY } from "@/lib/wheel/geometry";
import { formatNumber } from "@/lib/trends/format";

const SIZE = 360;
const CENTER = SIZE / 2;
/** Room around the web for axis labels. */
const OPTS: RadarOptions = { size: SIZE, padding: 80 };
const RADIUS = SIZE / 2 - (OPTS.padding ?? 0);

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
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      role="img"
      aria-label={label}
      className="mx-auto block w-full max-w-[440px] overflow-visible"
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
        {rings.map((v) => (
          <text key={v} x={CENTER + 4} y={CENTER - (RADIUS * v) / max} dominantBaseline="middle">
            {`${v}h`}
          </text>
        ))}
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
