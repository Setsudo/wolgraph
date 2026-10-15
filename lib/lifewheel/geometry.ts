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

export const LIFEWHEEL_SIZE = 600;
export const LIFEWHEEL_RADIUS = 230;
/** Distance of the category label arcs beyond the wheel radius. */
export const LABEL_OFFSET = 16;
/** Angular inset of each label arc from its sector's boundaries, per side. */
export const LABEL_INSET_DEG = 3;

type Point = { x: number; y: number };

export type LabelArc = {
  /** Open arc path for <textPath>; reversed in the lower half so text reads upright. */
  d: string;
  centre: number;
  reversed: boolean;
  /** Arc length in viewBox units, for fitLabel. */
  available: number;
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
 * One label arc per sector at radius + LABEL_OFFSET, inset LABEL_INSET_DEG on
 * each side. Reversed when the sector centre is strictly between 90° and 270°.
 */
export function labelArcs(n: number, radius: number, size: number = LIFEWHEEL_SIZE): LabelArc[] {
  if (!(n > 0)) return [];
  const r = radius + LABEL_OFFSET;
  const span = 360 / n;
  return sectorCentres(n).map((centre, i) => {
    const start = i * span + LABEL_INSET_DEG;
    const end = (i + 1) * span - LABEL_INSET_DEG;
    const reversed = centre > 90 && centre < 270;
    return {
      d: arcPath(r, start, end, size, reversed),
      centre,
      reversed,
      available: Math.max(0, (r * (end - start) * Math.PI) / 180),
    };
  });
}
