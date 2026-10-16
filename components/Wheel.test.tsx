import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import {
  PREVIEW_CATEGORIES,
  PREVIEW_ENTRIES,
  SUB_PREVIEW_CATEGORIES,
  SUB_PREVIEW_ENTRIES,
} from "@/app/dev/day-preview/fixtures";
import { archivedSubParents, buildWheel, type WheelSegment } from "@/lib/wheel/model";
import { Wheel } from "./Wheel";

afterEach(cleanup);

const hours = Object.fromEntries(PREVIEW_ENTRIES.map((e) => [e.categoryId, e.hours]));
const segments = buildWheel(PREVIEW_CATEGORIES, hours);

function Harness({
  onOpen = () => {},
  total = 17.5,
  segs = segments,
}: {
  onOpen?: (key: string) => void;
  total?: number;
  segs?: WheelSegment[];
}) {
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <Wheel
      segments={segs}
      selectedKey={selected}
      total={total}
      onSelect={setSelected}
      onOpen={(key) => {
        setSelected(key);
        onOpen(key);
      }}
    />
  );
}

const group = () => screen.getByRole("group", { name: "Day wheel" });
const activeLabel = () => {
  const id = group().getAttribute("aria-activedescendant");
  return id ? document.getElementById(id)?.getAttribute("aria-label") : null;
};

describe("Wheel", () => {
  it("is a single tab stop with one labelled button per main", () => {
    render(<Harness />);
    expect(group().getAttribute("tabindex")).toBe("0");
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(8);
    for (const b of buttons) expect(b.getAttribute("tabindex")).toBe("-1");
    const labels = buttons.map((b) => b.getAttribute("aria-label"));
    expect(labels).toContain("Health, 8.5 hours, 2 subcategories");
    expect(labels).toContain("Career, 6 hours, 2 subcategories");
    expect(labels).toContain("Family, 2 hours");
    expect(labels).toContain("Finance, 0 hours");
  });

  it("draws outer sub segments as display only", () => {
    const { container } = render(<Harness />);
    const outer = [...container.querySelectorAll("path[data-segment^='outer:']")];
    expect(outer).toHaveLength(4);
    for (const p of outer) {
      expect(p.getAttribute("aria-hidden")).toBe("true");
      expect(p.hasAttribute("role")).toBe(false);
      expect(p.hasAttribute("tabindex")).toBe(false);
      expect(p.hasAttribute("aria-label")).toBe(false);
    }
  });

  it("moves with arrow keys between mains only", () => {
    render(<Harness />);
    const g = group();
    fireEvent.keyDown(g, { key: "ArrowRight" });
    expect(activeLabel()).toBe("Health, 8.5 hours, 2 subcategories");
    fireEvent.keyDown(g, { key: "ArrowRight" });
    expect(activeLabel()).toBe("Personal Growth, 0 hours");
    fireEvent.keyDown(g, { key: "ArrowLeft" });
    fireEvent.keyDown(g, { key: "ArrowLeft" });
    expect(activeLabel()).toBe("Spirituality, 0 hours");
    fireEvent.keyDown(g, { key: "ArrowRight" });
    // Down and Up never reach the outer ring.
    fireEvent.keyDown(g, { key: "ArrowDown" });
    expect(activeLabel()).toBe("Health, 8.5 hours, 2 subcategories");
    fireEvent.keyDown(g, { key: "ArrowUp" });
    expect(activeLabel()).toBe("Health, 8.5 hours, 2 subcategories");
    const seen = new Set<string>();
    for (let i = 0; i < 8; i++) {
      fireEvent.keyDown(g, { key: "ArrowRight" });
      seen.add(g.getAttribute("aria-activedescendant")!);
    }
    expect(seen.size).toBe(8);
    for (const id of seen) expect(document.getElementById(id)?.getAttribute("role")).toBe("button");
  });

  it("opens the selected main with Enter or Space, and on a click on its inner or outer segments", () => {
    const onOpen = vi.fn();
    const { container } = render(<Harness onOpen={onOpen} />);
    const g = group();
    fireEvent.keyDown(g, { key: "Enter" });
    expect(onOpen).toHaveBeenLastCalledWith("inner:health");
    fireEvent.keyDown(g, { key: "ArrowRight" });
    fireEvent.keyDown(g, { key: " " });
    expect(onOpen).toHaveBeenLastCalledWith("inner:personal-growth");
    fireEvent.click(screen.getByRole("button", { name: "Career, 6 hours, 2 subcategories" }));
    expect(onOpen).toHaveBeenLastCalledWith("inner:career");
    fireEvent.click(container.querySelector("path[data-segment='outer:sleep']")!);
    expect(onOpen).toHaveBeenLastCalledWith("inner:health");
    expect(activeLabel()).toBe("Health, 8.5 hours, 2 subcategories");
  });

  it("outlines the selected main's inner segment and all its outer segments", () => {
    const { container } = render(<Harness />);
    fireEvent.click(container.querySelector("path[data-segment='outer:meetings']")!);
    const outlines = [...container.querySelectorAll("[data-testid=selection]")].map((p) =>
      p.getAttribute("d"),
    );
    const career = segments.filter((s) => s.mainId === "career").map((s) => s.path);
    expect(outlines).toEqual(career);
    expect(outlines).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: "Family, 2 hours" }));
    expect(container.querySelectorAll("[data-testid=selection]")).toHaveLength(1);
  });

  it("shows the total and turns amber over 24", () => {
    const { container, rerender } = render(<Harness total={17.5} />);
    expect(container.textContent).toContain("17.5 h");
    expect(container.textContent).toContain("of 24");
    rerender(<Harness total={25.25} />);
    expect(container.textContent).toContain("25.25 h");
    expect(container.textContent).toContain("over 24");
    const amber = container.querySelectorAll("text.fill-amber");
    expect(amber).toHaveLength(2);
  });

  it("renders every name on its own arc with a textPath", () => {
    const { container } = render(<Harness />);
    const paths = [...container.querySelectorAll("textPath")];
    expect(paths).toHaveLength(segments.length);
    const names = paths.map((p) => p.textContent);
    for (const name of [
      "Health",
      "Personal Growth",
      "Relationships",
      "Sleep",
      "Exercise",
      "Deep work",
      "Meetings",
    ]) {
      expect(names).toContain(name);
    }
    for (const p of paths) {
      expect(p.getAttribute("startOffset")).toBe("50%");
      const href = p.getAttribute("href")!;
      const arc = container.querySelector(`defs ${href}`);
      expect(arc?.tagName).toBe("path");
      expect(arc?.getAttribute("d")).toMatch(/^M [\d.]+ [\d.]+ A /);
      const text = p.parentElement!;
      expect(text.getAttribute("text-anchor")).toBe("middle");
      expect(text.getAttribute("dominant-baseline")).toBe("central");
      const size = Number(text.getAttribute("font-size"));
      expect(size).toBeGreaterThanOrEqual(9);
      expect(size).toBeLessThanOrEqual(14);
    }
  });

  it("shows hours for subs and subless mains with time, and none at zero", () => {
    const { container } = render(<Harness />);
    const hourTexts = [...container.querySelectorAll("text[transform]")].map((t) => t.textContent);
    // Sleep, Exercise, Deep work, Meetings, Family, Relaxation.
    expect(hourTexts.sort()).toEqual(["1", "1", "2", "2", "4", "7.5"]);
  });

  it("omits outer names and hours that do not fit, so no text overlaps (10 subs)", () => {
    const hours = Object.fromEntries(SUB_PREVIEW_ENTRIES.map((e) => [e.categoryId, e.hours]));
    const crowded = buildWheel(
      SUB_PREVIEW_CATEGORIES,
      hours,
      archivedSubParents(SUB_PREVIEW_CATEGORIES, SUB_PREVIEW_ENTRIES),
    );
    const { container } = render(<Harness segs={crowded} />);
    const hourTexts = [...container.querySelectorAll("text[transform]")].map((t) => t.textContent);
    // Health's 3 subs fit (7.5, 1, 0.5); Family and Relaxation are subless. None of
    // Career's 10 subs fit, though four have hours.
    expect(hourTexts.sort()).toEqual(["0.5", "1", "1", "2", "7.5"]);
    const names = [...container.querySelectorAll("textPath")].map((p) => p.textContent);
    for (const sub of ["Deep work", "Meetings", "Email", "Reviews", "Admin"]) {
      expect(
        names.some((n) => n === sub || (n?.endsWith("…") && sub.startsWith(n.slice(0, -1)))),
      ).toBe(false);
    }
    expect(names).toContain("Career");
  });
});
