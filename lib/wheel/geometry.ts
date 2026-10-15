/**
 * Entry-wheel geometry (SPEC §7). Pure functions, no DOM or React.
 *
 * Angles are degrees, clockwise from 12 o'clock. Coordinates are SVG viewBox
 * units for a square of side `size` with the wheel centred at size/2.
 */

export type WheelInput = { id: string; subIds: string[] }[]; // mains in sort order
export type WheelOptions = { size: number; gapDeg?: number }; // gapDeg default 0.8
export type Ring = "inner" | "outer";
export type Segment = {
  key: string; // `${ring}:${categoryId}` (unique)
  categoryId: string; // main id (inner, and outer when main has no subs) or sub id
  mainId: string;
  ring: Ring;
  startAngle: number; // unpadded; 0 <= start < 360
  endAngle: number; // unpadded; may be 360
  innerR: number;
  outerR: number;
  path: string; // closed annular sector with the gap applied
  labelPoint: { x: number; y: number }; // mid-angle, mid-radius
  labelAngle: number; // tangent rotation for SVG text, kept upright, in [-90, 90]
};

/** Ring radii as fractions of the wheel radius (size / 2). */
export const RADII = {
  hole: 0.3,
  inner: [0.32, 0.66],
  outer: [0.68, 0.98],
} as const;

const DEFAULT_GAP_DEG = 0.8;
const EPS = 1e-7;

/** Point at radius r and angle (clockwise from 12 o'clock) around the wheel centre. */
export function polarToXY(r: number, angleDeg: number, size: number): { x: number; y: number } {
  const c = size / 2;
  const rad = (angleDeg * Math.PI) / 180;
  return { x: c + r * Math.sin(rad), y: c - r * Math.cos(rad) };
}

function fmt(n: number): string {
  const v = Math.round(n * 100) / 100;
  return String(Object.is(v, -0) ? 0 : v);
}

function pt(r: number, angleDeg: number, size: number): string {
  const { x, y } = polarToXY(r, angleDeg, size);
  return `${fmt(x)} ${fmt(y)}`;
}

/**
 * SVG path for the annular sector from startAngle to endAngle (no gap applied
 * here). A span of 360° or more is drawn as a full annulus from two half arcs
 * per circle, with the inner circle wound the opposite way so it is a hole
 * under the default nonzero fill rule.
 */
export function annularSectorPath(
  startAngle: number,
  endAngle: number,
  innerR: number,
  outerR: number,
  size: number,
): string {
  const span = endAngle - startAngle;
  const R = fmt(outerR);
  const r = fmt(innerR);
  if (span >= 360 - EPS) {
    return (
      `M ${pt(outerR, 0, size)} A ${R} ${R} 0 0 1 ${pt(outerR, 180, size)} ` +
      `A ${R} ${R} 0 0 1 ${pt(outerR, 0, size)} Z ` +
      `M ${pt(innerR, 0, size)} A ${r} ${r} 0 0 0 ${pt(innerR, 180, size)} ` +
      `A ${r} ${r} 0 0 0 ${pt(innerR, 0, size)} Z`
    );
  }
  const large = span > 180 ? 1 : 0;
  return (
    `M ${pt(outerR, startAngle, size)} ` +
    `A ${R} ${R} 0 ${large} 1 ${pt(outerR, endAngle, size)} ` +
    `L ${pt(innerR, endAngle, size)} ` +
    `A ${r} ${r} 0 ${large} 0 ${pt(innerR, startAngle, size)} Z`
  );
}

/** Rotation for text along the tangent at angle a, flipped so it never reads upside down. */
function uprightTangentAngle(a: number): number {
  if (a > 90 && a < 270) return a - 180;
  if (a >= 270) return a - 360;
  return a;
}

function makeSegment(
  ring: Ring,
  categoryId: string,
  mainId: string,
  startAngle: number,
  endAngle: number,
  innerR: number,
  outerR: number,
  size: number,
  gapDeg: number,
): Segment {
  const span = endAngle - startAngle;
  const full = span >= 360 - EPS;
  // Half the gap off each side; clamp so a very thin sector keeps a positive span.
  const trim = full ? 0 : Math.min(gapDeg / 2, span / 4);
  const mid = (startAngle + endAngle) / 2;
  return {
    key: `${ring}:${categoryId}`,
    categoryId,
    mainId,
    ring,
    startAngle,
    endAngle,
    innerR,
    outerR,
    path: annularSectorPath(startAngle + trim, endAngle - trim, innerR, outerR, size),
    labelPoint: polarToXY((innerR + outerR) / 2, mid, size),
    labelAngle: uprightTangentAngle(mid),
  };
}

/** Lays out the two-ring wheel: inner segments in main order, then outer segments. */
export function layoutWheel(mains: WheelInput, opts: WheelOptions): Segment[] {
  const n = mains.length;
  if (n === 0) return [];
  const { size } = opts;
  const gapDeg = Math.max(0, opts.gapDeg ?? DEFAULT_GAP_DEG);
  const R = size / 2;
  const [innerIn, innerOut] = [RADII.inner[0] * R, RADII.inner[1] * R];
  const [outerIn, outerOut] = [RADII.outer[0] * R, RADII.outer[1] * R];

  const inner: Segment[] = [];
  const outer: Segment[] = [];
  mains.forEach((main, i) => {
    const start = (i * 360) / n;
    const end = ((i + 1) * 360) / n;
    inner.push(makeSegment("inner", main.id, main.id, start, end, innerIn, innerOut, size, gapDeg));
    const k = main.subIds.length;
    if (k === 0) {
      outer.push(
        makeSegment("outer", main.id, main.id, start, end, outerIn, outerOut, size, gapDeg),
      );
      return;
    }
    const span = end - start;
    main.subIds.forEach((subId, j) => {
      const s = start + (j * span) / k;
      const e = j === k - 1 ? end : start + ((j + 1) * span) / k;
      outer.push(makeSegment("outer", subId, main.id, s, e, outerIn, outerOut, size, gapDeg));
    });
  });
  return [...inner, ...outer];
}

/**
 * Segment under (x, y), ignoring the angular gaps: a point in a gap belongs to
 * the segment whose unpadded range contains it, and an exact boundary angle
 * belongs to the segment starting there. The centre hole, the gap between the
 * rings and anything outside the wheel return null.
 */
export function hitTest(segments: Segment[], x: number, y: number, size: number): Segment | null {
  const c = size / 2;
  const dx = x - c;
  const dy = y - c;
  const r = Math.hypot(dx, dy);
  let a = (Math.atan2(dx, -dy) * 180) / Math.PI;
  if (a < 0) a += 360;
  if (a > 360 - EPS) a = 0;
  for (const s of segments) {
    if (r < s.innerR - EPS || r > s.outerR + EPS) continue;
    if (a >= s.startAngle - EPS && a < s.endAngle - EPS) return s;
  }
  return null;
}

/** Fill opacity for a segment's hours: 0 for none, then 0.25 rising linearly to 1 at 8 h. */
export function fillOpacity(hours: number): number {
  if (!(hours > 0)) return 0;
  return 0.25 + (0.75 * Math.min(hours, 8)) / 8;
}
