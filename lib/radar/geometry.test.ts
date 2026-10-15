import { describe, expect, it } from "vitest";
import {
  axisAngles,
  labelPosition,
  polygonPath,
  radarPoints,
  ringPath,
  ringSteps,
  scaleMax,
} from "./geometry";

const SIZE = 400;
const OPTS = { size: SIZE };
const C = SIZE / 2;
const R = SIZE / 2 - 48;
const dist = (p: { x: number; y: number }) => Math.hypot(p.x - C, p.y - C);

describe("axisAngles", () => {
  it("8 axes every 45° from 12 o'clock", () => {
    expect(axisAngles(8)).toEqual([0, 45, 90, 135, 180, 225, 270, 315]);
  });
  it("handles n < 3", () => {
    expect(axisAngles(0)).toEqual([]);
    expect(axisAngles(1)).toEqual([0]);
    expect(axisAngles(2)).toEqual([0, 180]);
  });
});

describe("scaleMax", () => {
  it.each([
    [[0, 0], 1],
    [[], 1],
    [[0.5], 1],
    [[1], 1],
    [[1.01], 2],
    [[2.5], 3],
    [[3.5, 1], 4],
    [[4.25], 6],
    [[7], 8],
    [[9], 10],
    [[11], 12],
    [[12.5], 16],
    [[17], 20],
    [[21], 24],
    [[24], 24],
    [[0, NaN, -3, 5], 6],
  ])("%j -> %i", (values, expected) => {
    expect(scaleMax(values)).toBe(expected);
  });
});

describe("ringSteps", () => {
  it("every 1 up to 4, every 2 up to 12, every 4 above", () => {
    expect(ringSteps(1)).toEqual([1]);
    expect(ringSteps(3)).toEqual([1, 2, 3]);
    expect(ringSteps(8)).toEqual([2, 4, 6, 8]);
    expect(ringSteps(16)).toEqual([4, 8, 12, 16]);
    expect(ringSteps(24)).toEqual([4, 8, 12, 16, 20, 24]);
  });
});

describe("radarPoints", () => {
  it("values at max land on the radius at the axis angles", () => {
    const pts = radarPoints(Array(8).fill(6), 6, OPTS);
    expect(pts).toHaveLength(8);
    pts.forEach((p) => expect(dist(p)).toBeCloseTo(R, 9));
    expect(pts[0].x).toBeCloseTo(C, 9);
    expect(pts[0].y).toBeCloseTo(C - R, 9); // 12 o'clock
    expect(pts[2].x).toBeCloseTo(C + R, 9); // 3 o'clock
    expect(pts[4].y).toBeCloseTo(C + R, 9); // 6 o'clock
  });

  it("scales linearly and respects padding", () => {
    const [p] = radarPoints([3], 6, { size: SIZE, padding: 0 });
    expect(dist(p)).toBeCloseTo(SIZE / 4, 9);
  });

  it("clamps above max and maps negative or NaN to the centre", () => {
    const pts = radarPoints([10, -2, NaN, Infinity], 4, OPTS);
    expect(dist(pts[0])).toBeCloseTo(R, 9);
    expect(dist(pts[1])).toBeCloseTo(0, 9);
    expect(dist(pts[2])).toBeCloseTo(0, 9);
    expect(dist(pts[3])).toBeCloseTo(R, 9);
  });

  it("returns valid output for n < 3", () => {
    expect(radarPoints([], 1, OPTS)).toEqual([]);
    expect(radarPoints([1, 1], 1, OPTS)).toHaveLength(2);
  });
});

describe("polygonPath and ringPath", () => {
  it("formats M/L/Z with 2 decimals", () => {
    expect(
      polygonPath([
        { x: 1.005, y: 2 },
        { x: 3.14159, y: -0.0001 },
        { x: 5, y: 6 },
      ]),
    ).toBe("M 1 2 L 3.14 0 L 5 6 Z");
    expect(polygonPath([])).toBe("");
  });

  it("ring at max is the outer n-gon", () => {
    expect(ringPath(4, 2, 2, OPTS)).toBe(`M 200 48 L 352 200 L 200 352 L 48 200 Z`);
    expect(ringPath(4, 1, 2, OPTS)).toBe(`M 200 124 L 276 200 L 200 276 L 124 200 Z`);
    expect(ringPath(0, 1, 2, OPTS)).toBe("");
    expect(ringPath(2, 1, 1, OPTS)).toBe("M 200 48 L 200 352 Z");
  });
});

describe("labelPosition", () => {
  it("sits just outside the radius with anchors by side", () => {
    const anchors = Array.from({ length: 8 }, (_, i) => labelPosition(i, 8, OPTS).anchor);
    expect(anchors).toEqual(["middle", "start", "start", "start", "middle", "end", "end", "end"]);
    for (let i = 0; i < 8; i++) expect(dist(labelPosition(i, 8, OPTS))).toBeGreaterThan(R);
  });

  it("uses middle within 10° of top and bottom", () => {
    // n = 36: axis 1 at 10°, axis 2 at 20°, axis 17 at 170°, axis 35 at 350°
    expect(labelPosition(1, 36, OPTS).anchor).toBe("middle");
    expect(labelPosition(2, 36, OPTS).anchor).toBe("start");
    expect(labelPosition(17, 36, OPTS).anchor).toBe("middle");
    expect(labelPosition(16, 36, OPTS).anchor).toBe("start");
    expect(labelPosition(19, 36, OPTS).anchor).toBe("middle");
    expect(labelPosition(20, 36, OPTS).anchor).toBe("end");
    expect(labelPosition(35, 36, OPTS).anchor).toBe("middle");
  });
});
