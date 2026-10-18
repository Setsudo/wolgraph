import { describe, expect, it } from "vitest";
import { arcPath } from "@/lib/wheel/geometry";
import {
  LABEL_GAP,
  LABEL_OUTSET_DEG,
  LABEL_OFFSET,
  LIFEWHEEL_RADIUS as R,
  LIFEWHEEL_SIZE as SIZE,
  CAPS_FIT,
  LABEL_BASE_SIZE,
  LABEL_MIN_SIZE,
  clampValue,
  fitLabels,
  ghostPath,
  labelArcs,
  points,
  ringRadii,
  sectorCentres,
  spokeAngles,
  bridgeRadius,
  valuedPath,
  valuedPoints,
  valueRadii,
} from "./geometry";
import { polygonPath } from "@/lib/radar/geometry";

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
  const toLen = (deg: number) => (r * deg * Math.PI) / 180;

  it("one arc per sector at R + 24, extending 4° beyond each boundary", () => {
    expect(LABEL_OFFSET).toBe(24);
    expect(LABEL_OUTSET_DEG).toBe(4);
    const arcs = labelArcs(8, R);
    expect(arcs).toHaveLength(8);
    expect(arcs[0].d).toBe(arcPath(r, -4, 49, SIZE, false));
    expect(arcs[3].d).toBe(arcPath(r, 131, 184, SIZE, true));
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

  it("available length is the outset arc length; pitch is the sector arc", () => {
    expect(labelArcs(8, R)[0].available).toBeCloseTo(toLen(53), 9);
    expect(labelArcs(9, R)[0].available).toBeCloseTo(toLen(48), 9);
    expect(labelArcs(3, R)[0].available).toBeCloseTo(toLen(128), 9);
    expect(labelArcs(12, R)[0].available).toBeCloseTo(toLen(38), 9);
    expect(labelArcs(8, R)[0].pitch).toBeCloseTo(toLen(45), 9);
  });

  it("labels stay inside the 600 viewBox", () => {
    expect(R + LABEL_OFFSET + LABEL_BASE_SIZE).toBeLessThan(SIZE / 2);
  });

  it("n <= 0 gives nothing", () => {
    expect(labelArcs(0, R)).toEqual([]);
  });
});

describe("fitLabels", () => {
  /** Width estimate used by fitLabels (fitLabel's 0.56 em over CAPS_FIT). */
  const width = (f: { text: string; fontSize: number }) =>
    (f.text.length * 0.56 * f.fontSize) / CAPS_FIT;
  const sizeFor = (text: string, available: number) =>
    (available * CAPS_FIT) / (text.length * 0.56);
  const ROOM = 150;

  it("uses base 19 and min 10", () => {
    expect(LABEL_BASE_SIZE).toBe(19);
    expect(LABEL_MIN_SIZE).toBe(10);
  });

  it("short labels all get the base size", () => {
    const fits = fitLabels(["HEALTH", "FAMILY", "CAREER"], [ROOM, ROOM, ROOM]);
    expect(fits.map((f) => f.fontSize)).toEqual([19, 19, 19]);
  });

  it("all labels share the smallest non-italic fitted size", () => {
    const fits = fitLabels(["HEALTH", "PERSONAL GROWTH", "SPIRITUALITY"], [ROOM, ROOM, ROOM]);
    const shared = sizeFor("PERSONAL GROWTH", ROOM);
    expect(shared).toBeLessThan(19);
    fits.forEach((f) => expect(f.fontSize).toBeCloseTo(shared, 9));
    expect(fits.map((f) => f.text)).toEqual(["HEALTH", "PERSONAL GROWTH", "SPIRITUALITY"]);
  });

  it("italic labels do not set the shared size but shrink on their own", () => {
    const fits = fitLabels(
      ["HEALTH", "FAMILY", "HOBBIES (ARCHIVED)"],
      [ROOM, ROOM, ROOM],
      [false, false, true],
    );
    expect(fits[0].fontSize).toBe(19);
    expect(fits[1].fontSize).toBe(19);
    expect(fits[2].fontSize).toBeCloseTo(sizeFor("HOBBIES (ARCHIVED)", ROOM), 9);
    expect(fits[2].text).toBe("HOBBIES (ARCHIVED)");
  });

  it("a short italic label never exceeds the shared size", () => {
    const fits = fitLabels(["PERSONAL GROWTH", "OLD"], [ROOM, ROOM], [false, true]);
    expect(fits[1].fontSize).toBeCloseTo(fits[0].fontSize, 9);
  });

  it("with no non-italic labels, each fits from the base size", () => {
    const fits = fitLabels(["OLD", "HOBBIES (ARCHIVED)"], [ROOM, ROOM], [true, true]);
    expect(fits[0].fontSize).toBe(19);
    expect(fits[1].fontSize).toBeLessThan(19);
  });

  it("a non-italic label truncated at the minimum pulls everyone to the minimum", () => {
    const fits = fitLabels(["RELATIONSHIPS AND COMMUNITY LIFE", "B"], [100, 100]);
    expect(fits.map((f) => f.fontSize)).toEqual([10, 10]);
    expect(fits[0].text).toMatch(/^RELATIONSHIP.*…$/);
    expect(fits[1].text).toBe("B");
  });

  describe("neighbour guard", () => {
    // Each label fits its own arc at 19, but two long neighbours would overlap.
    const texts = ["RELATIONSHIPS", "SPIRITUALITY", "A", "B", "C", "D"];
    const pitch = 150;
    const avail = Array(6).fill(250);

    it("two long non-italic neighbours lower the shared size until they clear", () => {
      const free = fitLabels(texts, avail);
      expect(free[0].fontSize).toBe(19);
      expect((width(free[0]) + width(free[1])) / 2).toBeGreaterThan(pitch - LABEL_GAP);

      const fits = fitLabels(texts, avail, [], pitch);
      const expected = (2 * (pitch - LABEL_GAP) * CAPS_FIT) / (0.56 * 25);
      fits.forEach((f) => expect(f.fontSize).toBeCloseTo(expected, 9));
      expect((width(fits[0]) + width(fits[1])) / 2).toBeCloseTo(pitch - LABEL_GAP, 9);
    });

    it("checks the wrap-around pair", () => {
      const wrapped = ["SPIRITUALITY", "A", "B", "C", "D", "RELATIONSHIPS"];
      const fits = fitLabels(wrapped, avail, [], pitch);
      expect((width(fits[5]) + width(fits[0])) / 2).toBeLessThanOrEqual(pitch - LABEL_GAP + 1e-9);
      expect(fits[0].fontSize).toBeLessThan(19);
    });

    it("a non-binding guard changes nothing", () => {
      expect(fitLabels(texts, avail, [], 1000)).toEqual(fitLabels(texts, avail));
    });

    it("an italic neighbour shrinks on its own instead of lowering the shared size", () => {
      const fits = fitLabels(texts, avail, [false, true], pitch);
      expect(fits[0].fontSize).toBe(19);
      expect(fits[2].fontSize).toBe(19);
      expect(fits[1].fontSize).toBeLessThan(19);
      expect((width(fits[0]) + width(fits[1])) / 2).toBeLessThanOrEqual(pitch - LABEL_GAP + 1e-9);
    });

    it("at the minimum size, overlapping neighbours get half the room each", () => {
      const long = ["RELATIONSHIPS AND MORE", "SPIRITUALITY AND MORE", "A"];
      const fits = fitLabels(long, [400, 400, 400], [], 60);
      expect(fits[0].fontSize).toBe(10);
      expect(fits[0].text.endsWith("…")).toBe(true);
      expect((width(fits[0]) + width(fits[1])) / 2).toBeLessThanOrEqual(60 - LABEL_GAP + 1e-9);
    });
  });
});

describe("valueRadii", () => {
  it("scales like points, keeps 0 at the centre and null as null", () => {
    expect(valueRadii([10, 5, 0, null, 15, -1], 10, R)).toEqual([R, R / 2, 0, null, R, 0]);
    expect(valueRadii([3, null], 0, R)).toEqual([0, null]);
  });
});

describe("valuedPoints and valuedPath", () => {
  const radiiOf = (values: (number | null)[]) => valueRadii(values, 10, R);

  it("number-only values give the same points and path as before", () => {
    const values = [8, 5, 9, 7, 2, 0, 5, 3];
    const pts = valuedPoints(radiiOf(values));
    expect(pts.map((p) => p.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(pts.map(({ x, y }) => ({ x, y }))).toEqual(points(values, 10, R));
    expect(valuedPath(pts)).toBe(polygonPath(points(values, 10, R)));
  });

  it("skips null sectors, keeping the others at their own sector centres", () => {
    const pts = valuedPoints(radiiOf([10, null, 10, null]));
    expect(pts.map((p) => p.index)).toEqual([0, 2]);
    expect(angleOf(pts[0])).toBeCloseTo(45, 9);
    expect(angleOf(pts[1])).toBeCloseTo(225, 9);
  });

  it("bridges straight from the previous valued vertex to the next: no notch to the centre", () => {
    const values = [8, 5, null, 7, 2, 6, 5, 3];
    const pts = valuedPoints(radiiOf(values));
    expect(pts).toHaveLength(7);
    const all = points(
      values.map((v) => v ?? 0),
      10,
      R,
    );
    const d = valuedPath(pts);
    // Vertex 1 is followed directly by vertex 3; the centre never appears.
    expect(d).toBe(polygonPath([all[0], all[1], all[3], all[4], all[5], all[6], all[7]]));
    expect(d).not.toContain("300 300");
  });

  it("all null: no points, no path", () => {
    expect(valuedPoints(radiiOf([null, null, null]))).toEqual([]);
    expect(valuedPath([])).toBe("");
  });

  it("one value: its point, no path (just the dot)", () => {
    const pts = valuedPoints(radiiOf([null, 7, null]));
    expect(pts).toHaveLength(1);
    expect(valuedPath(pts)).toBe("");
  });

  it("two values: an open line between them", () => {
    const pts = valuedPoints(radiiOf([10, null, 10, null]));
    // 45° and 225° at R: opposite ends of a diameter.
    const d = valuedPath(pts);
    expect(d).toMatch(/^M \S+ \S+ L \S+ \S+$/);
    expect(d).not.toContain("Z");
  });

  it("three values: a closed polygon", () => {
    expect(valuedPath(valuedPoints(radiiOf([1, null, 2, 3])))).toMatch(/ Z$/);
  });

  it("a 0 value is a vertex at the centre (only null is skipped)", () => {
    const pts = valuedPoints(radiiOf([5, 0, 5]));
    expect(pts).toHaveLength(3);
    expect(dist(pts[1])).toBeCloseTo(0, 9);
  });
});

describe("bridgeRadius", () => {
  it("is where the chord between neighbours crosses the sector's ray", () => {
    // Neighbours at 0° and 90°, both at R: the chord crosses 45° at R cos 45°.
    const a = { x: C, y: C - R };
    const b = { x: C + R, y: C };
    expect(bridgeRadius(a, b, 45)).toBeCloseTo(R * Math.SQRT1_2, 9);
    // Unequal neighbours: still on the straight line between them.
    const r = bridgeRadius(a, { x: C + R / 2, y: C }, 45);
    const p = { x: C + r * Math.SQRT1_2, y: C - r * Math.SQRT1_2 };
    const cross = (p.x - a.x) * (C - a.y) - (p.y - a.y) * (C + R / 2 - a.x);
    expect(Math.abs(cross)).toBeLessThan(1e-6);
  });

  it("is 0 when the chord passes on the far side of the centre or is parallel", () => {
    // Neighbours at 0° and 90°; the ray at 225° points away from the chord.
    expect(bridgeRadius({ x: C, y: C - R }, { x: C + R, y: C }, 225)).toBe(0);
    // Chord along the 0° ray itself.
    expect(bridgeRadius({ x: C, y: C - 10 }, { x: C, y: C - R }, 0)).toBe(0);
  });
});

describe("ghostPath", () => {
  it("is the valued path of the values, skipping null and missing ones", () => {
    const values = [8, null, 9, 7, undefined, 0, 5, 3];
    const radii = valueRadii(
      values.map((v) => v ?? null),
      10,
      R,
    );
    expect(ghostPath(values, 10, R)).toBe(valuedPath(valuedPoints(radii)));
    expect(ghostPath(values, 10, R).match(/[ML]/g)).toHaveLength(6);
  });

  it("is empty for fewer than two values", () => {
    expect(ghostPath([null, 4, null], 10, R)).toBe("");
    expect(ghostPath([], 10, R)).toBe("");
  });
});
