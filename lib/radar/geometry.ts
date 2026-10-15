/**
 * Trend radar geometry (SPEC §6.3). Pure functions, no DOM or React.
 *
 * Angles are degrees, clockwise from 12 o'clock (axis 0 points up). Coordinates
 * are SVG viewBox units for a square of side `size` centred at size/2.
 */

import { polarToXY } from "@/lib/wheel/geometry";

/** radius = size / 2 - padding; padding defaults to 48 to leave room for labels. */
export type RadarOptions = { size: number; padding?: number };
type Point = { x: number; y: number };

const DEFAULT_PADDING = 48;
/** Distance of axis labels beyond the radius. */
const LABEL_OFFSET = 12;
const SCALE_STEPS = [1, 2, 3, 4, 6, 8, 10, 12, 16, 20, 24];

function radius(opts: RadarOptions): number {
  return Math.max(0, opts.size / 2 - (opts.padding ?? DEFAULT_PADDING));
}

function fmt(n: number): string {
  const v = Math.round(n * 100) / 100;
  return String(Object.is(v, -0) ? 0 : v);
}

/** Non-finite or negative values become 0; values above max clamp to max. */
function clamp(v: number, max: number): number {
  if (!Number.isFinite(v) || v < 0) return Number.isNaN(v) || v < 0 ? 0 : max;
  return Math.min(v, max);
}

/** Angle of each of n axes: i * 360 / n, starting at 0 (12 o'clock). */
export function axisAngles(n: number): number[] {
  if (!(n > 0)) return [];
  return Array.from({ length: n }, (_, i) => (i * 360) / n);
}

/**
 * Smallest of 1,2,3,4,6,8,10,12,16,20,24 at or above the largest value; 1 when
 * all values are 0 (or there are none). Above 24, the next multiple of 4.
 */
export function scaleMax(values: number[]): number {
  const max = values.reduce((m, v) => (Number.isFinite(v) && v > m ? v : m), 0);
  return SCALE_STEPS.find((s) => s >= max) ?? Math.ceil(max / 4) * 4;
}

/** Web ring values: step 1 up to max 4, step 2 up to 12, else step 4; excludes 0, ends at max. */
export function ringSteps(max: number): number[] {
  if (!(max > 0)) return [];
  const step = max <= 4 ? 1 : max <= 12 ? 2 : 4;
  const out: number[] = [];
  for (let v = step; v < max; v += step) out.push(v);
  out.push(max);
  return out;
}

/** Polygon vertices: value i on axis i, scaled so max lands on the radius. */
export function radarPoints(values: number[], max: number, opts: RadarOptions): Point[] {
  const r = radius(opts);
  const angles = axisAngles(values.length);
  return values.map((v, i) => {
    const frac = max > 0 ? clamp(v, max) / max : 0;
    return polarToXY(r * frac, angles[i], opts.size);
  });
}

/** "M x y L x y ... Z" with 2-decimal coordinates; "" for no points. */
export function polygonPath(points: Point[]): string {
  if (points.length === 0) return "";
  const [first, ...rest] = points;
  const lines = rest.map((p) => ` L ${fmt(p.x)} ${fmt(p.y)}`).join("");
  return `M ${fmt(first.x)} ${fmt(first.y)}${lines} Z`;
}

/** Closed n-gon web ring at `value` on a 0..max scale. */
export function ringPath(n: number, value: number, max: number, opts: RadarOptions): string {
  if (!(n > 0)) return "";
  return polygonPath(
    radarPoints(
      Array.from({ length: n }, () => value),
      max,
      opts,
    ),
  );
}

/**
 * Label anchor for axis i, just outside the radius. Text anchor is "middle"
 * within 10° of 0 or 180, "start" on the right half, "end" on the left.
 */
export function labelPosition(
  i: number,
  n: number,
  opts: RadarOptions,
): { x: number; y: number; anchor: "start" | "middle" | "end" } {
  const a = n > 0 ? ((((i * 360) / n) % 360) + 360) % 360 : 0;
  const { x, y } = polarToXY(radius(opts) + LABEL_OFFSET, a, opts.size);
  const nearVertical = a <= 10 || a >= 350 || Math.abs(a - 180) <= 10;
  const anchor = nearVertical ? "middle" : a < 180 ? "start" : "end";
  return { x, y, anchor };
}
