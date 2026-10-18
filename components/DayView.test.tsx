import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { PREVIEW_CATEGORIES, PREVIEW_ENTRIES } from "@/app/dev/day-preview/fixtures";
import type { CopyPreviousDay, SaveEntry } from "@/lib/data/day";
import { addDays, todayLocal } from "@/lib/date";
import { COPY_FAILED_MESSAGE, DayView, SAVE_FAILED_MESSAGE } from "./DayView";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

beforeEach(() => vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] }));
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  push.mockReset();
});

function renderDay(save: SaveEntry, date = todayLocal()) {
  render(
    <DayView date={date} categories={PREVIEW_CATEGORIES} entries={PREVIEW_ENTRIES} save={save} />,
  );
}

const career = () => screen.getByRole("button", { name: /^Career, / });
const plus = () => screen.getByRole("button", { name: "Increase Deep work by 0.25 hours" });
const row = (name: string) =>
  screen.getAllByTestId("hours-row").find((r) => r.querySelector("p")?.textContent === name)!;

describe("DayView", () => {
  it("debounces saves per category and saves the last value", async () => {
    const save = vi.fn<SaveEntry>().mockResolvedValue({ ok: true });
    renderDay(save);
    fireEvent.click(career());
    fireEvent.click(plus());
    fireEvent.click(plus());
    expect(within(row("Deep work")).getByText("4.50 h")).toBeTruthy();
    expect(within(row("Deep work")).getByRole("status").textContent).toBe("Saving…");
    expect(within(row("General")).getByRole("status").textContent).toBe("");
    await act(async () => vi.advanceTimersByTime(399));
    expect(save).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTime(1));
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(todayLocal(), "deep-work", 4.5);
    expect(within(row("Deep work")).getByRole("status").textContent).toBe("Saved");
    expect(career().getAttribute("aria-label")).toBe("Career, 6.5 hours, 2 subcategories");
    expect(screen.getByText("Total 6.5 h")).toBeTruthy();
  });

  it("saves 0 on Clear", async () => {
    const save = vi.fn<SaveEntry>().mockResolvedValue({ ok: true });
    renderDay(save);
    fireEvent.click(career());
    fireEvent.click(row("Deep work"));
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    await act(async () => vi.advanceTimersByTime(400));
    expect(save).toHaveBeenCalledWith(todayLocal(), "deep-work", 0);
  });

  it("rolls back and shows a toast when the save fails", async () => {
    const save = vi.fn<SaveEntry>().mockRejectedValue(new Error("network"));
    renderDay(save);
    fireEvent.click(career());
    fireEvent.click(plus());
    expect(screen.getByText("4.25 h")).toBeTruthy();
    await act(async () => vi.advanceTimersByTime(400));
    expect(screen.getByText("4.00 h")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toBe(SAVE_FAILED_MESSAGE);
    await act(async () => vi.advanceTimersByTime(4000));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("rolls back on an { ok: false } result too", async () => {
    const save = vi.fn<SaveEntry>().mockResolvedValue({ ok: false, message: "nope" });
    renderDay(save);
    fireEvent.click(career());
    fireEvent.click(row("Deep work"));
    fireEvent.click(screen.getByRole("button", { name: "Add 8 hours" }));
    await act(async () => vi.advanceTimersByTime(400));
    expect(screen.getByText("4.00 h")).toBeTruthy();
    expect(screen.getByRole("alert")).toBeTruthy();
  });

  it("makes future days read-only", () => {
    const save = vi.fn<SaveEntry>();
    renderDay(save, "2999-01-01");
    fireEvent.click(career());
    for (const b of within(screen.getByRole("list")).getAllByRole("button")) {
      expect((b as HTMLButtonElement).disabled).toBe(true);
    }
    expect(
      (screen.getByRole("button", { name: "Add 1 hours" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect((screen.getByRole("button", { name: "Clear" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(screen.getByText("Future days can't be edited.")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Next day" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it("navigates between days and back to today", () => {
    renderDay(vi.fn<SaveEntry>(), "2020-03-01");
    fireEvent.click(screen.getByRole("button", { name: "Previous day" }));
    expect(push).toHaveBeenLastCalledWith("/day/2020-02-29");
    fireEvent.click(screen.getByRole("button", { name: "Next day" }));
    expect(push).toHaveBeenLastCalledWith("/day/2020-03-02");
    fireEvent.click(screen.getByRole("button", { name: "Today" }));
    expect(push).toHaveBeenLastCalledWith(`/day/${todayLocal()}`);
  });

  it("hides Today and disables next on today", () => {
    renderDay(vi.fn<SaveEntry>());
    expect(screen.queryByRole("button", { name: "Today" })).toBeNull();
    expect((screen.getByRole("button", { name: "Next day" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it("closes the sheet on Escape", () => {
    renderDay(vi.fn<SaveEntry>());
    fireEvent.click(career());
    const sheet = screen.getByRole("region", { name: "Hours" });
    expect(sheet.className).toContain("visible translate-y-0");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(sheet.className).toContain("invisible translate-y-full");
  });
});

describe("DayView with fresh server data", () => {
  it("adopts new entries for settled categories and keeps unsettled edits", async () => {
    const save = vi.fn<SaveEntry>().mockResolvedValue({ ok: true });
    const date = todayLocal();
    const props = { date, categories: PREVIEW_CATEGORIES, save };
    const { rerender } = render(<DayView {...props} entries={PREVIEW_ENTRIES} />);
    fireEvent.click(career());
    fireEvent.click(plus()); // Deep work 4 -> 4.25, still debouncing
    // Server re-render (e.g. after another category's save or another device): Deep work
    // still 4 there, Meetings changed to 3, Sleep removed.
    rerender(
      <DayView
        {...props}
        entries={[
          { categoryId: "deep-work", hours: 4 },
          { categoryId: "meetings", hours: 3 },
          { categoryId: "exercise", hours: 1 },
        ]}
      />,
    );
    expect(within(row("Deep work")).getByText("4.25 h")).toBeTruthy();
    expect(within(row("Meetings")).getByText("3.00 h")).toBeTruthy();
    expect(career().getAttribute("aria-label")).toBe("Career, 7.25 hours, 2 subcategories");
    expect(screen.getByRole("button", { name: /^Health, / }).getAttribute("aria-label")).toBe(
      "Health, 1 hours, 2 subcategories",
    ); // Sleep removed
    await act(async () => vi.advanceTimersByTime(400));
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(date, "deep-work", 4.25);
    expect(within(row("Deep work")).getByText("4.25 h")).toBeTruthy();
  });

  it("does not flush debounced saves when only the save prop identity changes", async () => {
    const save = vi.fn<SaveEntry>().mockResolvedValue({ ok: true });
    const props = { date: todayLocal(), categories: PREVIEW_CATEGORIES, entries: PREVIEW_ENTRIES };
    const { rerender } = render(<DayView {...props} save={save} />);
    fireEvent.click(career());
    fireEvent.click(plus());
    const save2 = vi.fn<SaveEntry>().mockResolvedValue({ ok: true });
    rerender(<DayView {...props} save={save2} />);
    expect(save).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTime(400));
    expect(save2).toHaveBeenCalledTimes(1);
  });

  it("puts the toast above the open sheet, and fixed at the bottom when closed", async () => {
    renderDay(vi.fn<SaveEntry>().mockRejectedValue(new Error("x")));
    fireEvent.click(career());
    fireEvent.click(plus());
    await act(async () => vi.advanceTimersByTime(400));
    const sheet = screen.getByRole("region", { name: "Hours" });
    let toast = screen.getByRole("alert");
    expect(sheet.contains(toast)).toBe(true);
    expect(toast.className).toContain("bottom-[calc(100%+12px)]");
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    toast = screen.getByRole("alert");
    expect(sheet.contains(toast)).toBe(false);
    expect(toast.className).toContain("fixed bottom-6");
  });
});

describe("DayView with subcategories", () => {
  const wheel = () => screen.getByRole("group", { name: "Day wheel" });
  const title = () => screen.getByRole("heading", { level: 2 }).textContent;

  it("logs on a sub and on its main's General row: both save, both count in the day total", async () => {
    const save = vi.fn<SaveEntry>().mockResolvedValue({ ok: true });
    const date = todayLocal();
    // An archived sub's entry: not on the wheel, but part of the day total and Career's total.
    const entries = [
      ...PREVIEW_ENTRIES,
      { categoryId: "archived-sub", hours: 1, parentId: "career" },
    ];
    render(<DayView date={date} categories={PREVIEW_CATEGORIES} entries={entries} save={save} />);
    expect(screen.getAllByRole("button", { name: /hours(, \d+ subcategories)?$/ })).toHaveLength(8);
    expect(wheel().textContent).toContain("18.5 h"); // 17.5 on the wheel + 1 archived

    fireEvent.click(career());
    expect(title()).toBe("Career");
    expect(screen.getByText("Total 7 h")).toBeTruthy(); // 4 + 2 + 1 archived
    expect(
      screen.getAllByTestId("hours-row").map((r) => r.querySelector("p")!.textContent),
    ).toEqual(["General", "Deep work", "Meetings"]);
    fireEvent.click(plus());
    fireEvent.click(screen.getByRole("button", { name: "Increase General by 0.25 hours" }));

    await act(async () => vi.advanceTimersByTime(400));
    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenCalledWith(date, "deep-work", 4.25);
    expect(save).toHaveBeenCalledWith(date, "career", 0.25);
    expect(career().getAttribute("aria-label")).toBe("Career, 7.5 hours, 2 subcategories");
    expect(screen.getByText("Total 7.5 h")).toBeTruthy();
    expect(wheel().textContent).toContain("19 h");
  });

  it("a click on an outer sub segment opens its main", () => {
    const { container } = render(
      <DayView
        date={todayLocal()}
        categories={PREVIEW_CATEGORIES}
        entries={PREVIEW_ENTRIES}
        save={vi.fn<SaveEntry>()}
      />,
    );
    fireEvent.click(container.querySelector("path[data-segment='outer:meetings']")!);
    expect(title()).toBe("Career");
    expect(row("General").dataset.active).toBe("true");
  });

  it("chips and Clear target the active row; it resets to General when a main opens", async () => {
    const save = vi.fn<SaveEntry>().mockResolvedValue({ ok: true });
    const date = todayLocal();
    renderDay(save, date);
    fireEvent.click(career());
    expect(screen.getByText("Quick add to General")).toBeTruthy();
    fireEvent.click(row("Meetings"));
    expect(row("Meetings").dataset.active).toBe("true");
    expect(screen.getByText("Quick add to Meetings")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Add 1 hours" }));
    expect(within(row("Meetings")).getByText("3.00 h")).toBeTruthy();
    await act(async () => vi.advanceTimersByTime(400));
    expect(save).toHaveBeenLastCalledWith(date, "meetings", 3);

    // Opening another main and coming back starts on General again.
    fireEvent.click(screen.getByRole("button", { name: /^Health, / }));
    expect(title()).toBe("Health");
    expect(row("General").dataset.active).toBe("true");
    fireEvent.click(row("Sleep"));
    fireEvent.click(career());
    expect(row("General").dataset.active).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    await act(async () => vi.advanceTimersByTime(400));
    expect(save).toHaveBeenLastCalledWith(date, "career", 0);
  });

  it("a main without subs keeps the single stepper and saves its own entry", async () => {
    const save = vi.fn<SaveEntry>().mockResolvedValue({ ok: true });
    const date = todayLocal();
    renderDay(save, date);
    fireEvent.click(screen.getByRole("button", { name: "Family, 2 hours" }));
    expect(title()).toBe("Family");
    expect(screen.queryAllByTestId("hours-row")).toHaveLength(0);
    expect(screen.getByText("Quick add")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Increase by 0.25 hours" }));
    expect(screen.getByText("2.25 h")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("Saving…");
    await act(async () => vi.advanceTimersByTime(400));
    expect(save).toHaveBeenCalledWith(date, "family", 2.25);
    expect(screen.getByRole("status").textContent).toBe("Saved");
  });
});

describe("DayView copy previous day", () => {
  const COPIED = PREVIEW_ENTRIES.map(({ categoryId, hours }) => ({ categoryId, hours }));
  /** The day total in the wheel's centre. */
  const wheelTotal = () => document.querySelector('text[font-size="28"]')?.textContent;
  const copyButton = () => screen.queryByRole("button", { name: /^Copy / });

  function renderEmpty(save: SaveEntry, copy: CopyPreviousDay, date = todayLocal()) {
    render(
      <DayView
        date={date}
        categories={PREVIEW_CATEGORIES}
        entries={[]}
        previous={PREVIEW_ENTRIES}
        save={save}
        copy={copy}
      />,
    );
  }

  it("never copies on its own: nothing is written until the button is tapped", async () => {
    const save = vi.fn<SaveEntry>().mockResolvedValue({ ok: true });
    const copy = vi.fn<CopyPreviousDay>().mockResolvedValue({ ok: true, copied: COPIED });
    renderEmpty(save, copy);
    await act(async () => vi.advanceTimersByTime(5000));
    expect(copy).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
    expect(wheelTotal()).toBe("0 h");
    expect(copyButton()?.textContent).toBe("Copy yesterday's hours (17.5 h)");
  });

  it("copies on tap, fills the wheel, hides the button, and Undo clears the copy", async () => {
    const save = vi.fn<SaveEntry>().mockResolvedValue({ ok: true });
    const copy = vi.fn<CopyPreviousDay>().mockResolvedValue({ ok: true, copied: COPIED });
    renderEmpty(save, copy);
    await act(async () => fireEvent.click(copyButton()!));
    expect(copy).toHaveBeenCalledWith(todayLocal());
    expect(wheelTotal()).toBe("17.5 h");
    expect(copyButton()).toBeNull();
    expect(screen.getByRole("status").textContent).toContain("Copied 6 entries from yesterday.");

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    await act(async () => vi.advanceTimersByTime(400));
    expect(save).toHaveBeenCalledTimes(6);
    for (const e of COPIED) expect(save).toHaveBeenCalledWith(todayLocal(), e.categoryId, 0);
    expect(wheelTotal()).toBe("0 h");
  });

  it("shows a failure and changes nothing when the copy fails", async () => {
    const copy = vi.fn<CopyPreviousDay>().mockResolvedValue({ ok: false, message: "x" });
    renderEmpty(vi.fn<SaveEntry>(), copy);
    await act(async () => fireEvent.click(copyButton()!));
    expect(screen.getByRole("alert").textContent).toBe(COPY_FAILED_MESSAGE);
    expect(wheelTotal()).toBe("0 h");
  });

  it("is not offered once the day has hours, or on a future day, or with nothing to copy", () => {
    const copy = vi.fn<CopyPreviousDay>();
    render(
      <DayView
        date={todayLocal()}
        categories={PREVIEW_CATEGORIES}
        entries={PREVIEW_ENTRIES}
        previous={PREVIEW_ENTRIES}
        save={vi.fn<SaveEntry>()}
        copy={copy}
      />,
    );
    expect(copyButton()).toBeNull();
    cleanup();
    renderEmpty(vi.fn<SaveEntry>(), copy, addDays(todayLocal(), 1));
    expect(copyButton()).toBeNull();
    cleanup();
    render(
      <DayView
        date={todayLocal()}
        categories={PREVIEW_CATEGORIES}
        entries={[]}
        previous={[]}
        save={vi.fn<SaveEntry>()}
        copy={copy}
      />,
    );
    expect(copyButton()).toBeNull();
  });

  it("names the source date on a past day", () => {
    const day = addDays(todayLocal(), -3);
    renderEmpty(vi.fn<SaveEntry>(), vi.fn<CopyPreviousDay>(), day);
    expect(copyButton()?.textContent).toMatch(/^Copy hours from \w{3}, \w{3} \d+ \(17\.5 h\)$/);
  });
});
