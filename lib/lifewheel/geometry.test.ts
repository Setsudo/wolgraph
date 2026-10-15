import { describe, expect, it } from "vitest";
import { arcPath } from "@/lib/wheel/geometry";
import {
  LABEL_INSET_DEG,
  LABEL_OFFSET,
  LIFEWHEEL_RADIUS as R,
  LIFEWHEEL_SIZE as SIZE,
  clampValue,
  labelArcs,
  points,
  ringRadii,
  sectorCentres,
  spokeAngles,
} from "./geometry";

const C = SIZE / 2;
const dist = (p: { x: number; y: number }) => Math.hypot(p.x - C, p.y - C);
/** Angle of p clockwise from 12 o'clock, in [0, 360). */
const angleOf = (p: { x: number; y: number }) =>
  ((Math.atan2(p.x - C, C - p.y) * 180) / Math.PI + 360) % 360;

describe("spokeAngles and sectorCentres", () => {
  it("n = 8: spokes every 45°, centres 22.5 .. 337.5", () => {
    expect(spokeAngles(8)).toEqual([0, 45, 90, 135, 180, 225, 270, 315]);
    expect(sectorCentres(8)).toEqual([22.5, 67.5, 112.5, 157.5, 202.5, 247.5, 292.5, 337.5]);
  });

  it("n = 3 and n = 12", () => {
    expect(spokeAngles(3)).toEqual([0, 120, 240]);
    expect(sectorCentres(3)).toEqual([60, 180, 300]);
    expect(spokeAngles(12)).toHaveLength(12);
    expect(sectorCentres(12)[0]).toBe(15);
    expect(sectorCentres(12)[11]).toBe(345);
  });

  it("n <= 0 gives nothing", () => {
    expect(spokeAngles(0)).toEqual([]);
    expect(sectorCentres(0)).toEqual([]);
  });
});

describe("clampValue", () => {
  it("clamps to [0, max] and zeroes non-finite or negative", () => {
    expect(clampValue(5, 10)).toBe(5);
    expect(clampValue(12, 10)).toBe(10);
    expect(clampValue(-1, 10)).toBe(0);
    expect(clampValue(NaN, 10)).toBe(0);
    expect(clampValue(Infinity, 10)).toBe(0);
    expect(clampValue(-Infinity, 10)).toBe(0);
    expect(clampValue(3, 0)).toBe(0);
  });
});

describe("points", () => {
  it("plots at sector centres; category 0 between 12 and 1:30", () => {
    const pts = points(Array(8).fill(10), 10, R);
    pts.forEach((p, i) => {
      expect(dist(p)).toBeCloseTo(R, 9);
      expect(angleOf(p)).toBeCloseTo(22.5 + 45 * i, 9);
    });
    expect(pts[0].x).toBeGreaterThan(C);
    expect(pts[0].y).toBeLessThan(C);
  });

  it("scales linearly", () => {
    const [p] = points([2.5, 0, 0], 10, R);
    expect(dist(p)).toBeCloseTo(R / 4, 9);
    expect(angleOf(p)).toBeCloseTo(60, 9);
  });

  it("clamps above max and maps negative or non-finite to the centre", () => {
    const pts = points([15, -2, NaN, Infinity], 10, R);
    expect(dist(pts[0])).toBeCloseTo(R, 9);
    expect(dist(pts[1])).toBeCloseTo(0, 9);
    expect(dist(pts[2])).toBeCloseTo(0, 9);
    expect(dist(pts[3])).toBeCloseTo(0, 9);
  });

  it("all-zero values collapse to the centre", () => {
    points([0, 0, 0], 1, R).forEach((p) => expect(dist(p)).toBeCloseTo(0, 9));
  });
});

describe("ringRadii", () => {
  it("maps ring values linearly onto the radius", () => {
    expect(ringRadii([2, 4, 6, 8], 8, 200)).toEqual([50, 100, 150, 200]);
    expect(ringRadii([1, 5, 10], 10, R)).toEqual([23, 115, 230]);
    expect(ringRadii([12], 10, R)).toEqual([230]);
    expect(ringRadii([1], 0, R)).toEqual([0]);
  });
});

describe("labelArcs", () => {
  const r = R + LABEL_OFFSET;

  it("one arc per sector at R + 16, inset 3° each side", () => {
    const arcs = labelArcs(8, R);
    expect(arcs).toHaveLength(8);
    expect(arcs[0].d).toBe(arcPath(r, LABEL_INSET_DEG, 45 - LABEL_INSET_DEG, SIZE, false));
    expect(arcs[3].d).toBe(arcPath(r, 135 + LABEL_INSET_DEG, 180 - LABEL_INSET_DEG, SIZE, true));
  });

  it("reverses the lower half (centre in (90, 270)) so text reads upright", () => {
    expect(labelArcs(8, R).map((a) => a.reversed)).toEqual([
      false,
      false,
      true,
      true,
      true,
      true,
      false,
      false,
    ]);
    expect(labelArcs(3, R).map((a) => a.reversed)).toEqual([false, true, false]);
    // Centres exactly at 90° and 270° are not reversed.
    expect(labelArcs(2, R).map((a) => a.reversed)).toEqual([false, false]);
  });

  it("available length is the inset arc length", () => {
    const toLen = (deg: number) => (r * deg * Math.PI) / 180;
    expect(labelArcs(8, R)[0].available).toBeCloseTo(toLen(39), 9);
    expect(labelArcs(3, R)[0].available).toBeCloseTo(toLen(114), 9);
    expect(labelArcs(12, R)[0].available).toBeCloseTo(toLen(24), 9);
  });

  it("n <= 0 gives nothing", () => {
    expect(labelArcs(0, R)).toEqual([]);
  });
});
