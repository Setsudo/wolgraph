import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { PREVIEW_CATEGORIES, PREVIEW_ENTRIES } from "@/app/dev/day-preview/fixtures";
import { buildWheel } from "@/lib/wheel/model";
import { Wheel } from "./Wheel";

afterEach(cleanup);

const hours = Object.fromEntries(PREVIEW_ENTRIES.map((e) => [e.categoryId, e.hours]));
const segments = buildWheel(PREVIEW_CATEGORIES, hours);

function Harness({
  onOpen = () => {},
  total = 17.5,
}: {
  onOpen?: (key: string) => void;
  total?: number;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <Wheel
      segments={segments}
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
  it("is a single tab stop with one labelled button per segment", () => {
    render(<Harness />);
    expect(group().getAttribute("tabindex")).toBe("0");
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(segments.length);
    for (const b of buttons) expect(b.getAttribute("tabindex")).toBe("-1");
    const labels = buttons.map((b) => b.getAttribute("aria-label"));
    expect(labels).toContain("Health, general, 0 hours");
    expect(labels).toContain("Health, Sleep, 7.5 hours");
    expect(labels).toContain("Career, Deep work, 4 hours");
    expect(labels).toContain("Family, general, 2 hours");
  });

  it("moves with arrow keys in ring order and between rings", () => {
    render(<Harness />);
    const g = group();
    fireEvent.keyDown(g, { key: "ArrowRight" });
    expect(activeLabel()).toBe("Health, general, 0 hours");
    fireEvent.keyDown(g, { key: "ArrowRight" });
    expect(activeLabel()).toBe("Personal Growth, general, 0 hours");
    fireEvent.keyDown(g, { key: "ArrowLeft" });
    fireEvent.keyDown(g, { key: "ArrowLeft" });
    expect(activeLabel()).toBe("Spirituality, general, 0 hours");
    fireEvent.keyDown(g, { key: "ArrowRight" });
    fireEvent.keyDown(g, { key: "ArrowDown" });
    expect(activeLabel()).toBe("Health, Sleep, 7.5 hours");
    fireEvent.keyDown(g, { key: "ArrowRight" });
    expect(activeLabel()).toBe("Health, Exercise, 1 hours");
    fireEvent.keyDown(g, { key: "ArrowRight" });
    expect(activeLabel()).toBe("Personal Growth, general, 0 hours");
    fireEvent.keyDown(g, { key: "ArrowUp" });
    expect(activeLabel()).toBe("Personal Growth, general, 0 hours");
    expect(g.querySelector("[data-testid=selection]")).not.toBeNull();
  });

  it("opens the selected segment with Enter or Space, and on click", () => {
    const onOpen = vi.fn();
    render(<Harness onOpen={onOpen} />);
    const g = group();
    fireEvent.keyDown(g, { key: "Enter" });
    expect(onOpen).toHaveBeenLastCalledWith("inner:health");
    fireEvent.keyDown(g, { key: "ArrowRight" });
    fireEvent.keyDown(g, { key: " " });
    expect(onOpen).toHaveBeenLastCalledWith("inner:personal-growth");
    fireEvent.click(screen.getByRole("button", { name: "Career, Deep work, 4 hours" }));
    expect(onOpen).toHaveBeenLastCalledWith("outer:deep-work");
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

  it("labels the rings: names inside, sub names and hours outside", () => {
    const { container } = render(<Harness />);
    const text = container.textContent ?? "";
    expect(text).toContain("Personal Gr…");
    expect(text).toContain("Deep wo…");
    expect(text).toContain("Sleep");
    expect(text).toContain("7.5");
  });
});
