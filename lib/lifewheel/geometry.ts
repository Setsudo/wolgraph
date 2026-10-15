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
