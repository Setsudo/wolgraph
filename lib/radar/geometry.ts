/**
 * Trend scale helpers (SPEC §6.3). Pure functions, no DOM or React.
 * The chart itself is drawn by components/LifeWheel (geometry in lib/lifewheel).
 */

type Point = { x: number; y: number };

const SCALE_STEPS = [1, 2, 3, 4, 6, 8, 10, 12, 16, 20, 24];

function fmt(n: number): string {
  const v = Math.round(n * 100) / 100;
  return String(Object.is(v, -0) ? 0 : v);
}

/**
 * Smallest of 1,2,3,4,6,8,10,12,16,20,24 at or above the largest value; 1 when
 * all values are 0 (or there are none). Above 24, the next multiple of 4.
 */
export function scaleMax(values: number[]): number {
  const max = values.reduce((m, v) => (Number.isFinite(v) && v > m ? v : m), 0);
  return SCALE_STEPS.find((s) => s >= max) ?? Math.ceil(max / 4) * 4;
}

/** Ring values: step 1 up to max 4, step 2 up to 12, else step 4; excludes 0, ends at max. */
export function ringSteps(max: number): number[] {
  if (!(max > 0)) return [];
  const step = max <= 4 ? 1 : max <= 12 ? 2 : 4;
  const out: number[] = [];
  for (let v = step; v < max; v += step) out.push(v);
  out.push(max);
  return out;
}

/** "M x y L x y ... Z" with 2-decimal coordinates; "" for no points. */
export function polygonPath(points: Point[]): string {
  if (points.length === 0) return "";
  const [first, ...rest] = points;
  const lines = rest.map((p) => ` L ${fmt(p.x)} ${fmt(p.y)}`).join("");
  return `M ${fmt(first.x)} ${fmt(first.y)}${lines} Z`;
}
