import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { LifeWheel, type LifeWheelProps } from "./LifeWheel";

afterEach(cleanup);

const EIGHT = [
  "Health",
  "Personal Growth",
  "Finance",
  "Family",
  "Career",
  "Relaxation",
  "Relationships",
  "Spirituality",
];

function wheel(overrides: Partial<LifeWheelProps> = {}) {
  const props: LifeWheelProps = {
    labels: EIGHT,
    values: [8, 5, 9, 7, 2, 0, 5, 3],
    max: 10,
    rings: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    ringLabel: (v) => String(v),
    ariaLabel: "Life wheel",
    ...overrides,
  };
  return render(<LifeWheel {...props} />).container;
}

const all = (c: HTMLElement, part: string) => [...c.querySelectorAll(`[data-part="${part}"]`)];

describe("LifeWheel", () => {
  it("draws one data path, one dot per value and n spokes", () => {
    for (const n of [3, 8, 12]) {
      const c = wheel({
        labels: EIGHT.concat(EIGHT).slice(0, n),
        values: Array.from({ length: n }, (_, i) => i),
      });
      expect(all(c, "data")).toHaveLength(1);
      expect(all(c, "data")[0].tagName).toBe("path");
      expect(all(c, "dot")).toHaveLength(n);
      expect(all(c, "spoke")).toHaveLength(n);
      expect(all(c, "label")).toHaveLength(n);
      cleanup();
    }
  });

  it("draws ring circles below max, one boundary, and a label per ring value, never 0", () => {
    const c = wheel({ rings: [0, 2, 4, 6, 8, 10] });
    expect(all(c, "ring")).toHaveLength(4);
    expect(all(c, "boundary")).toHaveLength(1);
    const labels = all(c, "ring-label");
    expect(labels.map((t) => t.textContent)).toEqual(["2", "4", "6", "8", "10"]);
    // Along the right spoke: x = 300 + r - 3, y = 312, anchored at the end.
    expect(labels[4].getAttribute("x")).toBe("527");
    expect(labels[0].getAttribute("x")).toBe("343");
    for (const t of labels) {
      expect(t.getAttribute("y")).toBe("312");
      expect(t.getAttribute("text-anchor")).toBe("end");
    }
  });

  it("formats ring labels with ringLabel", () => {
    const c = wheel({ max: 3, rings: [1, 2, 3], ringLabel: (v) => `${v}h` });
    expect(all(c, "ring-label").map((t) => t.textContent)).toEqual(["1h", "2h", "3h"]);
  });

  it("draws the fill below the grid and the outline and dots above it", () => {
    const c = wheel();
    const order = [...c.querySelectorAll("[data-part]")].map((e) => e.getAttribute("data-part"));
    expect(all(c, "data")[0].getAttribute("class")).toContain("fill-teal");
    expect(all(c, "data-outline")).toHaveLength(1);
    expect(all(c, "data-outline")[0].getAttribute("d")).toBe(all(c, "data")[0].getAttribute("d"));
    expect(order.indexOf("data")).toBeLessThan(order.indexOf("ring"));
    expect(order.indexOf("data-outline")).toBeGreaterThan(order.lastIndexOf("spoke"));
    expect(order.indexOf("data-outline")).toBeGreaterThan(order.indexOf("boundary"));
    expect(order.indexOf("dot")).toBeGreaterThan(order.indexOf("data-outline"));
  });

  it("sets ring labels in the display serif", () => {
    const c = wheel();
    expect(all(c, "ring-label")[0].parentElement?.getAttribute("class")).toContain("font-display");
  });

  it("puts each label on its own arc via textPath, uppercased", () => {
    const c = wheel();
    const labels = all(c, "label");
    const ids = new Set<string>();
    labels.forEach((l, i) => {
      const tp = l.querySelector("textPath");
      expect(tp).not.toBeNull();
      const href = tp!.getAttribute("href")!;
      expect(href).toMatch(/^#[A-Za-z0-9_-]+$/);
      expect(c.querySelector(href)?.tagName).toBe("path");
      ids.add(href);
      expect(tp!.textContent).toBe(EIGHT[i].toUpperCase());
      expect(tp!.getAttribute("startOffset")).toBe("50%");
    });
    expect(ids.size).toBe(8);
    // One shared size for all, set by the longest label.
    const sizes = new Set(labels.map((l) => l.getAttribute("font-size")));
    expect(sizes.size).toBe(1);
  });

  it("shrinks an italic label on its own below the shared size", () => {
    const c = wheel({
      labels: ["Health", "Family", "A rather long archived name", "D", "E", "F", "G", "H"],
      values: [1, 2, 3, 4, 5, 6, 7, 8],
      italic: [false, false, true],
    });
    const [a, b, archived] = all(c, "label");
    const size = (l: Element) => Number(l.getAttribute("font-size"));
    expect(size(a)).toBe(19);
    expect(size(b)).toBe(19);
    expect(size(archived)).toBeLessThan(19);
    expect(size(archived)).toBeGreaterThanOrEqual(10);
  });

  it("leaves room for wide uppercase glyphs", () => {
    // n = 8: the inset arc is about 167 units; caps run about 0.76 em each.
    const c = wheel();
    const growth = all(c, "label")[1];
    const size = Number(growth.getAttribute("font-size"));
    expect(size).toBeLessThan(19);
    expect(15 * 0.76 * size).toBeLessThanOrEqual(167);
  });

  it("sets italic per label", () => {
    const c = wheel({ italic: [false, true] });
    const labels = all(c, "label");
    expect(labels[0].getAttribute("font-style")).toBeNull();
    expect(labels[1].getAttribute("font-style")).toBe("italic");
    expect(labels[2].getAttribute("font-style")).toBeNull();
  });

  it("is an img with the given label", () => {
    wheel({ ariaLabel: "Scores: Health 8" });
    expect(screen.getByRole("img", { name: "Scores: Health 8" })).toBeTruthy();
  });

  it("all-zero and out-of-range values stay inside the wheel", () => {
    const c = wheel({ values: [0, 0, 0, 0, 0, 0, 0, 0], max: 1, rings: [1] });
    expect(all(c, "ring")).toHaveLength(0);
    for (const d of all(c, "dot")) {
      expect(d.getAttribute("cx")).toBe("300");
      expect(d.getAttribute("cy")).toBe("300");
    }
    const c2 = wheel({ values: [50, -1, NaN, 0, 0, 0, 0, 0] });
    const [far] = all(c2, "dot");
    const dx = Number(far.getAttribute("cx")) - 300;
    const dy = Number(far.getAttribute("cy")) - 300;
    expect(Math.hypot(dx, dy)).toBeCloseTo(230, 6);
  });
});
