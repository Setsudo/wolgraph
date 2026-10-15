import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { HourSheet } from "./HourSheet";

afterEach(cleanup);

function renderSheet(props: Partial<Parameters<typeof HourSheet>[0]> = {}) {
  const onChange = vi.fn();
  render(
    <HourSheet
      title="Career · Deep work"
      hours={4}
      open
      readOnly={false}
      future={false}
      status={null}
      onChange={onChange}
      onClose={() => {}}
      {...props}
    />,
  );
  return onChange;
}

describe("HourSheet", () => {
  it("shows the title and the value with two decimals", () => {
    renderSheet();
    expect(screen.getByRole("heading").textContent).toBe("Career · Deep work");
    expect(screen.getByText("4.00 h")).toBeTruthy();
  });

  it("steps by 0.25 and clamps", () => {
    const onChange = renderSheet({ hours: 24 });
    fireEvent.click(screen.getByRole("button", { name: "Increase by 0.25 hours" }));
    expect(onChange).toHaveBeenLastCalledWith(24);
    fireEvent.click(screen.getByRole("button", { name: "Decrease by 0.25 hours" }));
    expect(onChange).toHaveBeenLastCalledWith(23.75);
  });

  it("chips add and clamp; Clear sets 0", () => {
    const onChange = renderSheet({ hours: 20 });
    fireEvent.click(screen.getByRole("button", { name: "Add 0.5 hours" }));
    expect(onChange).toHaveBeenLastCalledWith(20.5);
    fireEvent.click(screen.getByRole("button", { name: "Add 8 hours" }));
    expect(onChange).toHaveBeenLastCalledWith(24);
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(onChange).toHaveBeenLastCalledWith(0);
  });

  it("disables every control on a read-only day and shows the note", () => {
    const onChange = renderSheet({ readOnly: true, future: true });
    const controls = [
      "Decrease by 0.25 hours",
      "Increase by 0.25 hours",
      "Add 0.5 hours",
      "Add 1 hours",
      "Add 2 hours",
      "Add 4 hours",
      "Add 8 hours",
      "Clear",
    ].map((name) => screen.getByRole("button", { name }) as HTMLButtonElement);
    for (const c of controls) {
      expect(c.disabled).toBe(true);
      fireEvent.click(c);
    }
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText("Future days can't be edited.")).toBeTruthy();
  });

  it("shows the save status", () => {
    renderSheet({ status: "saving" });
    expect(screen.getByRole("status").textContent).toBe("Saving…");
  });

  it("shows the md-only placeholder when nothing is selected", () => {
    renderSheet({ title: null });
    const placeholder = screen.getByTestId("hours-placeholder");
    expect(placeholder.textContent).toBe("Tap a category to log hours.");
    // jsdom ignores media queries: assert it is hidden on phones and shown from md.
    expect(placeholder.classList).toContain("hidden");
    expect(placeholder.classList).toContain("md:block");
    expect(screen.queryByRole("button", { name: "Clear" })).toBeNull();
  });

  it("does not show the placeholder when a category is selected", () => {
    renderSheet();
    expect(screen.queryByTestId("hours-placeholder")).toBeNull();
  });
});
