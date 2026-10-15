import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { RatingSlider } from "./RatingSlider";

afterEach(cleanup);

/** The fraction f in `calc(11px + (100% - 22px) * f)`, in whichever order jsdom serialises it. */
function fraction(css: string): number {
  const m = /^calc\(11px \+ (?:\(100% - 22px\) \* ([\d.]+)|([\d.]+) \* \(100% - 22px\))\)$/.exec(
    css,
  );
  if (!m) throw new Error(`unexpected position ${css}`);
  return Number(m[1] ?? m[2]);
}

describe("RatingSlider", () => {
  it("is a 0-10 range named after the category, with a spoken value", () => {
    render(<RatingSlider label="Health" value={8} onChange={() => {}} />);
    const slider = screen.getByRole("slider", { name: "Health rating" });
    expect(slider.getAttribute("min")).toBe("0");
    expect(slider.getAttribute("max")).toBe("10");
    expect(slider.getAttribute("step")).toBe("1");
    expect((slider as HTMLInputElement).value).toBe("8");
    expect(slider.getAttribute("aria-valuetext")).toBe("8 out of 10");
    expect(screen.getByText("Health").tagName).toBe("LABEL");
  });

  it("shows tick numbers 0..10 placed at the thumb positions", () => {
    const { container } = render(<RatingSlider label="Health" value={3} onChange={() => {}} />);
    const ticks = [...container.querySelectorAll('[data-part="tick"]')] as HTMLElement[];
    expect(ticks.map((t) => t.textContent)).toEqual(
      Array.from({ length: 11 }, (_, i) => String(i)),
    );
    expect(fraction(ticks[0].style.left)).toBe(0);
    expect(fraction(ticks[10].style.left)).toBe(1);
  });

  it("shows the value in a box under the thumb, and fills the track up to it", () => {
    const { container, rerender } = render(
      <RatingSlider label="Health" value={3} onChange={() => {}} />,
    );
    const box = container.querySelector('[data-part="value"]') as HTMLElement;
    expect(box.textContent).toBe("3");
    expect(fraction(box.style.left)).toBe(0.3);
    rerender(<RatingSlider label="Health" value={10} onChange={() => {}} />);
    expect(box.textContent).toBe("10");
    expect(fraction(box.style.left)).toBe(1);
    const fill = container.querySelector('[data-part="fill"]') as HTMLElement;
    expect(fraction(fill.style.width)).toBe(1);
  });

  it("reports changes as numbers and shows the save status", () => {
    const onChange = vi.fn();
    const { rerender } = render(<RatingSlider label="Career" value={2} onChange={onChange} />);
    fireEvent.change(screen.getByRole("slider"), { target: { value: "6" } });
    expect(onChange).toHaveBeenCalledWith(6);
    expect(screen.getByRole("status").textContent).toBe("");
    rerender(<RatingSlider label="Career" value={6} onChange={onChange} status="saved" />);
    expect(screen.getByRole("status").textContent).toBe("Saved");
  });
});
