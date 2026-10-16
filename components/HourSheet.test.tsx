import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { HourSheet, type SheetRow } from "./HourSheet";

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

const ROWS: SheetRow[] = [
  { id: "career", name: "General", hours: 0.5, status: null },
  { id: "deep-work", name: "Deep work", hours: 4, status: "saving" },
  { id: "meetings", name: "Meetings", hours: 0, status: "saved" },
];

function renderRows(props: Partial<Parameters<typeof HourSheet>[0]> = {}) {
  const onChange = vi.fn();
  const onRowChange = vi.fn();
  const onActivate = vi.fn();
  const view = render(
    <HourSheet
      title="Career"
      hours={0.5}
      rows={ROWS}
      total={6}
      activeId={null}
      onActivate={onActivate}
      onRowChange={onRowChange}
      open
      readOnly={false}
      future={false}
      status={null}
      onChange={onChange}
      onClose={() => {}}
      {...props}
    />,
  );
  return { onChange, onRowChange, onActivate, rerender: view.rerender };
}

const rows = () => screen.getAllByTestId("hours-row");

describe("HourSheet with subcategory rows", () => {
  it("shows the main's name, its total and General first, then each sub", () => {
    renderRows();
    expect(screen.getByRole("heading").textContent).toBe("Career");
    expect(screen.getByText("Total 6 h")).toBeTruthy();
    expect(rows().map((r) => r.querySelector("p")!.textContent)).toEqual([
      "General",
      "Deep work",
      "Meetings",
    ]);
    expect(within(rows()[0]).getByText("0.50 h")).toBeTruthy();
    expect(within(rows()[1]).getByText("4.00 h")).toBeTruthy();
    // No single stepper.
    expect(screen.queryByRole("button", { name: "Increase by 0.25 hours" })).toBeNull();
  });

  it("each row's stepper changes that row's category", () => {
    const { onRowChange, onChange } = renderRows();
    fireEvent.click(screen.getByRole("button", { name: "Increase Deep work by 0.25 hours" }));
    expect(onRowChange).toHaveBeenLastCalledWith("deep-work", 4.25);
    fireEvent.click(screen.getByRole("button", { name: "Decrease General by 0.25 hours" }));
    expect(onRowChange).toHaveBeenLastCalledWith("career", 0.25);
    fireEvent.click(screen.getByRole("button", { name: "Decrease Meetings by 0.25 hours" }));
    expect(onRowChange).toHaveBeenLastCalledWith("meetings", 0);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("shows each row's save status under its name", () => {
    renderRows();
    expect(within(rows()[0]).getByRole("status").textContent).toBe("");
    expect(within(rows()[1]).getByRole("status").textContent).toBe("Saving…");
    expect(within(rows()[2]).getByRole("status").textContent).toBe("Saved");
  });

  it("General is active by default; quick add and Clear act on the active row", () => {
    const { onRowChange, onActivate, rerender } = renderRows();
    expect(rows()[0].dataset.active).toBe("true");
    expect(rows()[0].className).toContain("bg-teal/10");
    expect(screen.getByText("Quick add to General")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Add 1 hours" }));
    expect(onRowChange).toHaveBeenLastCalledWith("career", 1.5);

    fireEvent.click(rows()[1]);
    expect(onActivate).toHaveBeenLastCalledWith("deep-work");
    fireEvent.click(screen.getByRole("button", { name: "Increase Meetings by 0.25 hours" }));
    expect(onActivate).toHaveBeenLastCalledWith("meetings");

    rerender(
      <HourSheet
        title="Career"
        hours={0.5}
        rows={ROWS}
        total={6}
        activeId="deep-work"
        onActivate={onActivate}
        onRowChange={onRowChange}
        open
        readOnly={false}
        future={false}
        status={null}
        onChange={() => {}}
        onClose={() => {}}
      />,
    );
    expect(rows()[0].dataset.active).toBeUndefined();
    expect(rows()[1].dataset.active).toBe("true");
    expect(screen.getByText("Quick add to Deep work")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Add 8 hours" }));
    expect(onRowChange).toHaveBeenLastCalledWith("deep-work", 12);
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(onRowChange).toHaveBeenLastCalledWith("deep-work", 0);
  });

  it("disables every row stepper, chip and Clear on a read-only day", () => {
    const { onRowChange, onChange } = renderRows({ readOnly: true, future: true });
    const controls = screen
      .getAllByRole("button")
      .filter((b) => b.textContent !== "Done") as HTMLButtonElement[];
    expect(controls).toHaveLength(3 * 2 + 5 + 1);
    for (const c of controls) {
      expect(c.disabled).toBe(true);
      fireEvent.click(c);
    }
    expect(onRowChange).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText("Future days can't be edited.")).toBeTruthy();
  });

  it("caps the phone sheet at 75vh and scrolls the list", () => {
    renderRows();
    const sheet = screen.getByRole("region", { name: "Hours" });
    expect(sheet.className).toContain("max-h-[75vh]");
    expect(screen.getByRole("list").className).toContain("overflow-y-auto");
  });

  it("a main without rows keeps the single stepper and plain Quick add label", () => {
    renderSheet({ title: "Family", rows: null });
    expect(screen.queryAllByTestId("hours-row")).toHaveLength(0);
    expect(screen.queryByText(/^Total /)).toBeNull();
    expect(screen.getByText("Quick add")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Increase by 0.25 hours" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Hours" }).className).not.toContain("max-h-");
  });
});
