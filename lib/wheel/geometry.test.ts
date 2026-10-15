import { describe, expect, it } from "vitest";
import {
  annularSectorPath,
  fillOpacity,
  hitTest,
  layoutWheel,
  polarToXY,
  type Segment,
  type WheelInput,
} from "./geometry";

const SIZE = 400;
const R = SIZE / 2;

/** n mains; alternating 0 and 5 subs (main 0 has none, main 1 has five, ...). */
function mains(n: number): WheelInput {
  return Array.from({ length: n }, (_, i) => ({
    id: `m${i}`,
    subIds: i % 2 === 0 ? [] : Array.from({ length: 5 }, (_, j) => `m${i}s${j}`),
  }));
}

const ring = (segs: Segment[], r: "inner" | "outer") => segs.filter((s) => s.ring === r);
const arcCount = (path: string) => (path.match(/A/g) ?? []).length;

describe("layoutWheel counts, keys and order", () => {
  it.each([1, 3, 8, 12])("%i mains with mixed 0 and 5 subs", (n) => {
    const input = mains(n);
    const segs = layoutWheel(input, { size: SIZE });
    const withSubs = input.filter((m) => m.subIds.length > 0).length;
    const expectedOuter = n - withSubs + withSubs * 5;

    expect(ring(segs, "inner")).toHaveLength(n);
    expect(ring(segs, "outer")).toHaveLength(expectedOuter);
    expect(segs).toHaveLength(n + expectedOuter);
    expect(new Set(segs.map((s) => s.key)).size).toBe(segs.length);

    // Inner first in main order, then outer in main then sub order.
    const expectedOrder = [
      ...input.map((m) => `inner:${m.id}`),
      ...input.flatMap((m) =>
        m.subIds.length === 0 ? [`outer:${m.id}`] : m.subIds.map((s) => `outer:${s}`),
      ),
    ];
    expect(segs.map((s) => s.key)).toEqual(expectedOrder);
    for (const s of segs) expect(s.key).toBe(`${s.ring}:${s.categoryId}`);
  });

  it("maps a main with no subs to one outer segment for the main itself", () => {
    const segs = layoutWheel(mains(3), { size: SIZE });
    const outerM0 = segs.filter((s) => s.ring === "outer" && s.mainId === "m0");
    expect(outerM0).toHaveLength(1);
    expect(outerM0[0].categoryId).toBe("m0");
    expect(outerM0[0].startAngle).toBe(0);
    expect(outerM0[0].endAngle).toBe(120);
  });

  it("splits a main's angle equally among its five subs", () => {
    const segs = layoutWheel(mains(3), { size: SIZE });
    const subs = segs.filter((s) => s.ring === "outer" && s.mainId === "m1");
    expect(subs.map((s) => s.categoryId)).toEqual(["m1s0", "m1s1", "m1s2", "m1s3", "m1s4"]);
    expect(subs[0].startAngle).toBe(120);
    expect(subs[4].endAngle).toBe(240);
    for (const s of subs) expect(s.endAngle - s.startAngle).toBeCloseTo(24, 9);
  });

  it("returns no segments for no mains", () => {
    expect(layoutWheel([], { size: SIZE })).toEqual([]);
  });
});

describe("layoutWheel angles and radii", () => {
  it.each([1, 3, 7, 8, 12])("%i mains: each ring tiles 360 contiguously from 0", (n) => {
    const segs = layoutWheel(mains(n), { size: SIZE });
    for (const r of ["inner", "outer"] as const) {
      const rs = ring(segs, r);
      expect(rs[0].startAngle).toBe(0);
      expect(rs.at(-1)!.endAngle).toBe(360);
      const total = rs.reduce((sum, s) => sum + (s.endAngle - s.startAngle), 0);
      expect(total).toBeCloseTo(360, 9);
      for (let i = 1; i < rs.length; i++) expect(rs[i].startAngle).toBe(rs[i - 1].endAngle);
      for (const s of rs) {
        expect(s.startAngle).toBeGreaterThanOrEqual(0);
        expect(s.startAngle).toBeLessThan(360);
      }
    }
  });

  it("gives every main an equal angle", () => {
    const inner = ring(layoutWheel(mains(8), { size: SIZE }), "inner");
    for (const s of inner) expect(s.endAngle - s.startAngle).toBeCloseTo(45, 9);
  });

  it("uses the ring radii from the spec", () => {
    const segs = layoutWheel(mains(3), { size: SIZE });
    for (const s of ring(segs, "inner")) {
      expect(s.innerR).toBeCloseTo(0.32 * R, 9);
      expect(s.outerR).toBeCloseTo(0.66 * R, 9);
    }
    for (const s of ring(segs, "outer")) {
      expect(s.innerR).toBeCloseTo(0.68 * R, 9);
      expect(s.outerR).toBeCloseTo(0.98 * R, 9);
    }
  });

  it("places label points at mid-angle, mid-radius", () => {
    const segs = layoutWheel(mains(3), { size: SIZE });
    for (const s of segs) {
      const p = polarToXY((s.innerR + s.outerR) / 2, (s.startAngle + s.endAngle) / 2, SIZE);
      expect(s.labelPoint.x).toBeCloseTo(p.x, 9);
      expect(s.labelPoint.y).toBeCloseTo(p.y, 9);
    }
  });

  it.each([1, 2, 3, 4, 8, 12])("%i mains: label angles stay upright in [-90, 90]", (n) => {
    for (const s of layoutWheel(mains(n), { size: SIZE })) {
      expect(s.labelAngle).toBeGreaterThanOrEqual(-90);
      expect(s.labelAngle).toBeLessThanOrEqual(90);
    }
  });

  it("follows the tangent, flipping the lower half", () => {
    const inner = ring(layoutWheel(mains(4), { size: SIZE }), "inner");
    // Mid-angles 45, 135, 225, 315.
    expect(inner.map((s) => s.labelAngle)).toEqual([45, -45, 45, -45]);
    const two = ring(layoutWheel(mains(2), { size: SIZE }), "inner");
    // Mid-angles 90 and 270: both vertical, both upright.
    expect(two.map((s) => s.labelAngle)).toEqual([90, -90]);
  });
});

describe("paths", () => {
  it("polarToXY puts 0° at 12 o'clock and runs clockwise", () => {
    expect(polarToXY(100, 0, SIZE)).toEqual({ x: 200, y: 100 });
    const right = polarToXY(100, 90, SIZE);
    expect(right.x).toBeCloseTo(300, 9);
    expect(right.y).toBeCloseTo(200, 9);
  });

  it.each([1, 3, 8, 12])("%i mains: paths are closed and NaN-free with 2-decimal numbers", (n) => {
    for (const s of layoutWheel(mains(n), { size: SIZE })) {
      expect(s.path).not.toMatch(/NaN|Infinity/);
      expect(s.path.trim().endsWith("Z")).toBe(true);
      const nums = s.path.match(/-?\d+(\.\d+)?/g) ?? [];
      for (const num of nums) expect(num).toMatch(/^-?\d+(\.\d{1,2})?$/);
    }
  });

  it("n = 1 draws full annuli from half arcs, no gap", () => {
    const segs = layoutWheel(mains(1), { size: SIZE });
    expect(segs).toHaveLength(2);
    for (const s of segs) {
      expect(s.startAngle).toBe(0);
      expect(s.endAngle).toBe(360);
      expect(s.path).not.toMatch(/NaN/);
      // Two half arcs for the outer circle and two for the inner (the hole).
      expect(arcCount(s.path)).toBe(4);
      const subpaths = s.path.split("M").filter((p) => p.trim());
      expect(subpaths).toHaveLength(2);
      for (const sp of subpaths) expect(arcCount(sp)).toBe(2);
      // Starts exactly at 12 o'clock on the outer radius: no gap trimmed.
      expect(s.path.startsWith(`M 200 ${200 - s.outerR}`)).toBe(true);
    }
  });

  it("applies half the gap on each side of a sector", () => {
    const [first] = layoutWheel(mains(4), { size: SIZE, gapDeg: 2 });
    const start = polarToXY(first.outerR, 1, SIZE);
    expect(
      first.path.startsWith(
        `M ${Math.round(start.x * 100) / 100} ${Math.round(start.y * 100) / 100}`,
      ),
    ).toBe(true);
  });

  it("sets the large-arc flag only for spans over 180°", () => {
    const flags = (path: string) =>
      [...path.matchAll(/A [\d.]+ [\d.]+ 0 ([01]) [01]/g)].map((m) => m[1]);

    // Two mains give 180° unpadded (179.2° drawn) spans: no large arc.
    for (const s of layoutWheel(mains(2), { size: SIZE })) {
      expect(flags(s.path).every((f) => f === "0")).toBe(true);
    }
    expect(flags(annularSectorPath(0, 180, 50, 100, SIZE))).toEqual(["0", "0"]);
    expect(flags(annularSectorPath(0, 270, 50, 100, SIZE))).toEqual(["1", "1"]);
    expect(flags(annularSectorPath(30, 211, 50, 100, SIZE))).toEqual(["1", "1"]);
    expect(flags(annularSectorPath(30, 90, 50, 100, SIZE))).toEqual(["0", "0"]);
  });
});

describe("hitTest", () => {
  it.each([1, 3, 8, 12])("%i mains: each label point hits its own segment", (n) => {
    const segs = layoutWheel(mains(n), { size: SIZE });
    for (const s of segs) {
      expect(hitTest(segs, s.labelPoint.x, s.labelPoint.y, SIZE)?.key).toBe(s.key);
    }
  });

  it("assigns an exact boundary angle to the segment starting there", () => {
    const segs = layoutWheel(mains(12), { size: SIZE });
    for (const r of ["inner", "outer"] as const) {
      for (const s of ring(segs, r)) {
        const p = polarToXY((s.innerR + s.outerR) / 2, s.startAngle, SIZE);
        expect(hitTest(segs, p.x, p.y, SIZE)?.key).toBe(s.key);
      }
    }
  });

  it("assigns a point at 12 o'clock to the first segment", () => {
    const segs = layoutWheel(mains(3), { size: SIZE });
    expect(hitTest(segs, 200, 200 - 0.5 * R, SIZE)?.key).toBe("inner:m0");
    expect(hitTest(segs, 200, 200 - 0.8 * R, SIZE)?.key).toBe("outer:m0");
  });

  it("assigns points inside a gap to the adjacent segment by unpadded range", () => {
    const segs = layoutWheel(mains(3), { size: SIZE, gapDeg: 4 });
    const mid = 0.5 * R;
    // Boundary between inner m0 [0,120) and m1 [120,240) at 120°; gap is 118°..122°.
    const before = polarToXY(mid, 119, SIZE);
    const after = polarToXY(mid, 121, SIZE);
    expect(hitTest(segs, before.x, before.y, SIZE)?.key).toBe("inner:m0");
    expect(hitTest(segs, after.x, after.y, SIZE)?.key).toBe("inner:m1");
    // Just left of 12 o'clock belongs to the last main.
    const wrap = polarToXY(mid, 359.5, SIZE);
    expect(hitTest(segs, wrap.x, wrap.y, SIZE)?.key).toBe("inner:m2");
  });

  it("treats ring radius boundaries as inside", () => {
    const segs = layoutWheel(mains(3), { size: SIZE });
    const at = (frac: number) => polarToXY(frac * R, 60, SIZE);
    for (const [frac, key] of [
      [0.32, "inner:m0"],
      [0.66, "inner:m0"],
      [0.68, "outer:m0"],
      [0.98, "outer:m0"],
    ] as const) {
      const p = at(frac);
      expect(hitTest(segs, p.x, p.y, SIZE)?.key).toBe(key);
    }
  });

  it("returns null for the centre, the hole, the ring gap and outside", () => {
    const segs = layoutWheel(mains(3), { size: SIZE });
    expect(hitTest(segs, 200, 200, SIZE)).toBeNull();
    for (const frac of [0.1, 0.3, 0.31, 0.67, 0.99, 1.2]) {
      const p = polarToXY(frac * R, 60, SIZE);
      expect(hitTest(segs, p.x, p.y, SIZE)).toBeNull();
    }
    expect(hitTest(segs, 0, 0, SIZE)).toBeNull();
    expect(hitTest(segs, SIZE + 10, 200, SIZE)).toBeNull();
  });

  it("covers the whole ring for one main", () => {
    const segs = layoutWheel(mains(1), { size: SIZE });
    for (const a of [0, 90, 180, 270, 359.9]) {
      const p = polarToXY(0.5 * R, a, SIZE);
      expect(hitTest(segs, p.x, p.y, SIZE)?.key).toBe("inner:m0");
      const q = polarToXY(0.8 * R, a, SIZE);
      expect(hitTest(segs, q.x, q.y, SIZE)?.key).toBe("outer:m0");
    }
  });
});

describe("fillOpacity", () => {
  it.each([
    [0, 0],
    [-1, 0],
    [Number.NaN, 0],
    [0.25, 0.25 + (0.75 * 0.25) / 8],
    [4, 0.625],
    [8, 1],
    [12, 1],
  ])("fillOpacity(%s) = %s", (hours, expected) => {
    expect(fillOpacity(hours)).toBeCloseTo(expected, 12);
  });
});
