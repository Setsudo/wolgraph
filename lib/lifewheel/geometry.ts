/**
 * Life-wheel chart geometry (reference style, docs/design/reference-wheel.png).
 * Pure functions, no DOM or React.
 *
 * n categories split the circle into n equal sectors. Spokes sit on the sector
 * boundaries; values plot at the sector centres. Angles are degrees, clockwise
 * from 12 o'clock. Coordinates are SVG viewBox units for a square of side
 * `size` centred at size/2.
 */

import { arcPath, polarToXY } from "@/lib/wheel/geometry";
import { fitLabel } from "@/lib/wheel/model";

export const LIFEWHEEL_SIZE = 600;
export const LIFEWHEEL_RADIUS = 230;
/** Distance of the category label arcs beyond the wheel radius. */
export const LABEL_OFFSET = 24;
/** Each label arc extends this far beyond its sector's boundaries, per side. */
export const LABEL_OUTSET_DEG = 4;
/** Minimum clear arc length between neighbouring labels. */
export const LABEL_GAP = 8;

/** Category label font sizes, in viewBox units. */
export const LABEL_BASE_SIZE = 19;
export const LABEL_MIN_SIZE = 10;
/**
 * fitLabel assumes mixed-case glyphs (0.56 em); uppercase serif with 0.06em
 * tracking runs about 0.76 em per character, and text past the end of a
 * textPath is not drawn, so labels fit against a proportionally shorter length.
 */
export const CAPS_FIT = 0.73;
/** fitLabel's glyph width (em per character), used to estimate label widths. */
const FIT_GLYPH_WIDTH = 0.56;

type Point = { x: number; y: number };

export type LabelArc = {
  /** Open arc path for <textPath>; reversed in the lower half so text reads upright. */
  d: string;
  centre: number;
  reversed: boolean;
  /** Arc length in viewBox units, for fitLabel. */
  available: number;
  /** Arc distance between neighbouring label centres, for the overlap guard. */
  pitch: number;
};

/** Spoke angles: the sector boundaries i * 360 / n. */
export function spokeAngles(n: number): number[] {
  if (!(n > 0)) return [];
  return Array.from({ length: n }, (_, i) => (i * 360) / n);
}

/** Sector centre angles (i + 0.5) * 360 / n, where values plot. */
export function sectorCentres(n: number): number[] {
  if (!(n > 0)) return [];
  return Array.from({ length: n }, (_, i) => ((i + 0.5) * 360) / n);
}

/** Value clamped to [0, max]; non-finite or negative becomes 0. */
export function clampValue(v: number, max: number): number {
  if (!Number.isFinite(v) || v < 0 || !(max > 0)) return 0;
  return Math.min(v, max);
}

/** Polygon vertices: value i at sector centre i, scaled so max lands on `radius`. */
export function points(
  values: number[],
  max: number,
  radius: number,
  size: number = LIFEWHEEL_SIZE,
): Point[] {
  const centres = sectorCentres(values.length);
  return values.map((v, i) => {
    const r = max > 0 ? (radius * clampValue(v, max)) / max : 0;
    return polarToXY(r, centres[i], size);
  });
}

/** Radius of each ring value on a 0..max scale (clamped like values). */
export function ringRadii(rings: number[], max: number, radius: number): number[] {
  return rings.map((v) => (max > 0 ? (radius * clampValue(v, max)) / max : 0));
}

/**
 * One label arc per sector at radius + LABEL_OFFSET, extending
 * LABEL_OUTSET_DEG beyond each sector boundary. Reversed when the sector centre is strictly between 90° and 270°.
 */
export function labelArcs(n: number, radius: number, size: number = LIFEWHEEL_SIZE): LabelArc[] {
  if (!(n > 0)) return [];
  const r = radius + LABEL_OFFSET;
  const span = 360 / n;
  return sectorCentres(n).map((centre, i) => {
    const start = i * span - LABEL_OUTSET_DEG;
    const end = (i + 1) * span + LABEL_OUTSET_DEG;
    const reversed = centre > 90 && centre < 270;
    return {
      d: arcPath(r, start, end, size, reversed),
      centre,
      reversed,
      available: Math.max(0, (r * (end - start) * Math.PI) / 180),
      pitch: (r * span * Math.PI) / 180,
    };
  });
}

/** Estimated rendered width of an uppercase label, matching fitLabel's estimate. */
function capsWidth(text: string, fontSize: number): number {
  return (text.length * FIT_GLYPH_WIDTH * fontSize) / CAPS_FIT;
}

/**
 * Fits uppercase labels to their arcs at one shared size: the smallest size
 * any non-italic label needs (LABEL_BASE_SIZE when there is none). A label
 * that still does not fit at the shared size (e.g. an italic archived one)
 * shrinks on its own, down to LABEL_MIN_SIZE, then truncates.
 *
 * With `pitch` (arc distance between neighbouring label centres), adjacent
 * labels i and i + 1 (wrapping) must also keep
 * width_i / 2 + width_(i+1) / 2 <= pitch - LABEL_GAP. Two non-italic
 * neighbours lower the shared size; an italic label next to another label
 * shrinks on its own instead.
 */
export function fitLabels(
  texts: string[],
  available: number[],
  italic: boolean[] = [],
  pitch?: number,
): { text: string; fontSize: number }[] {
  const n = texts.length;
  const isItalic = (i: number) => italic[i] === true;
  const room = texts.map((_, i) => (available[i] ?? 0) * CAPS_FIT);
  const fit = (i: number, size: number, maxWidth = Infinity) =>
    fitLabel(texts[i], Math.min(room[i], maxWidth * CAPS_FIT), size, LABEL_MIN_SIZE);

  let shared = texts.reduce(
    (size, _, i) => (isItalic(i) ? size : Math.min(size, fit(i, LABEL_BASE_SIZE).fontSize)),
    LABEL_BASE_SIZE,
  );

  // Largest allowed (width_i + width_j) / 2 for neighbours; no guard without a pitch.
  const half = pitch !== undefined && n > 1 ? Math.max(0, pitch - LABEL_GAP) : Infinity;
  const neighbours = (i: number) => (n > 1 ? [(i + n - 1) % n, (i + 1) % n] : []);
  const pairs = n > 1 ? texts.map((_, i) => [i, (i + 1) % n] as const) : [];

  for (const [i, j] of pairs) {
    const chars = texts[i].length + texts[j].length;
    if (isItalic(i) || isItalic(j) || chars === 0) continue;
    shared = Math.min(shared, (2 * half * CAPS_FIT) / (FIT_GLYPH_WIDTH * chars));
  }
  shared = Math.max(shared, LABEL_MIN_SIZE);

  // Non-italic labels at the shared size; at the minimum size, a pair that
  // still overlaps gets half the room each.
  const out = texts.map((_, i) => (isItalic(i) ? null : fit(i, shared)));
  const width = (i: number) => {
    const f = out[i];
    return f ? capsWidth(f.text, f.fontSize) : 0;
  };
  const tooWide = new Set<number>();
  for (const [i, j] of pairs) {
    if (out[i] && out[j] && (width(i) + width(j)) / 2 > half) tooWide.add(i).add(j);
  }
  for (const i of tooWide) out[i] = fit(i, shared, half);

  // Italic labels fit into what their neighbours leave.
  return texts.map((_, i) => {
    const done = out[i];
    if (done) return done;
    const maxWidth = Math.min(
      ...neighbours(i).map((j) => (isItalic(j) ? half : Math.max(0, 2 * half - width(j)))),
    );
    return fit(i, shared, maxWidth);
  });
}

/** A plotted vertex: its sector index and position. */
export type SectorPoint = Point & { index: number };

/**
 * Radius of each value on a 0..max scale (clamped like `points`); null means
 * no value and stays null.
 */
export function valueRadii(
  values: (number | null)[],
  max: number,
  radius: number,
): (number | null)[] {
  return values.map((v) => (v === null ? null : max > 0 ? (radius * clampValue(v, max)) / max : 0));
}

/**
 * Vertices of the non-null radii at their sector centres, in sector order
 * (n = radii.length). A null sector is skipped, so the shape bridges straight
 * from the previous valued vertex to the next.
 */
export function valuedPoints(
  radii: (number | null)[],
  size: number = LIFEWHEEL_SIZE,
): SectorPoint[] {
  const centres = sectorCentres(radii.length);
  const out: SectorPoint[] = [];
  radii.forEach((r, i) => {
    if (r !== null) out.push({ index: i, ...polarToXY(r, centres[i], size) });
  });
  return out;
}

/**
 * A coordinate to 2 decimals, as paths are written. Dots use it too, so they
 * sit exactly on the path's vertices and server and browser trig (which can
 * differ in the last digits) render the same attribute.
 */
export function roundCoord(n: number): number {
  const v = Math.round(n * 100) / 100;
  return Object.is(v, -0) ? 0 : v;
}

function fmt(n: number): string {
  return String(roundCoord(n));
}

/**
 * Path through the valued vertices: "" for fewer than 2 (a lone value is just
 * its dot), an open line for 2, and a closed polygon (as polygonPath) for 3+.
 */
export function valuedPath(pts: Point[]): string {
  if (pts.length < 2) return "";
  const [first, ...rest] = pts;
  const lines = rest.map((p) => ` L ${fmt(p.x)} ${fmt(p.y)}`).join("");
  return `M ${fmt(first.x)} ${fmt(first.y)}${lines}${pts.length > 2 ? " Z" : ""}`;
}

/**
 * Radius at which the straight bridge from a to b crosses the ray from the
 * centre at `angle`: where a vertex on that ray sits flush with the bridge.
 * 0 when the bridge does not cross the ray on its positive side (it passes on
 * the far side of the centre, or runs parallel to the ray).
 */
export function bridgeRadius(
  a: Point,
  b: Point,
  angle: number,
  size: number = LIFEWHEEL_SIZE,
): number {
  const c = size / 2;
  const rad = (angle * Math.PI) / 180;
  const d = { x: Math.sin(rad), y: -Math.cos(rad) };
  const e = { x: b.x - a.x, y: b.y - a.y };
  const cross = (u: Point, v: Point) => u.x * v.y - u.y * v.x;
  const denom = cross(d, e);
  if (Math.abs(denom) < 1e-9) return 0;
  const w = { x: a.x - c, y: a.y - c };
  // centre + r d = a + s e  =>  r = cross(w, e) / cross(d, e), s = cross(w, d) / cross(d, e)
  const r = cross(w, e) / denom;
  const s = cross(w, d) / denom;
  if (!(r > 0) || s < -1e-9 || s > 1 + 1e-9) return 0;
  return r;
}

/**
 * Path of a display-only shape (the Rate screen's last rated day) for values
 * on 0..max, one per sector (n = values.length): null or missing values are
 * skipped like nulls in the data shape. "" when fewer than 2 are valued.
 */
export function ghostPath(
  values: (number | null | undefined)[],
  max: number,
  radius: number,
  size: number = LIFEWHEEL_SIZE,
): string {
  const radii = valueRadii(
    values.map((v) => (v === undefined || v === null || !Number.isFinite(v) ? null : v)),
    max,
    radius,
  );
  return valuedPath(valuedPoints(radii, size));
}
