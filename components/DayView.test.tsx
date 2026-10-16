import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PREVIEW_CATEGORIES, PREVIEW_ENTRIES } from "@/app/dev/day-preview/fixtures";
import type { SaveEntry } from "@/lib/data/day";
import { todayLocal } from "@/lib/date";
import { DayView, SAVE_FAILED_MESSAGE } from "./DayView";

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

const deepWork = () => screen.getByRole("button", { name: /^Career, Deep work, / });
const plus = () => screen.getByRole("button", { name: "Increase by 0.25 hours" });

describe("DayView", () => {
  it("debounces saves per category and saves the last value", async () => {
    const save = vi.fn<SaveEntry>().mockResolvedValue({ ok: true });
    renderDay(save);
    fireEvent.click(deepWork());
    fireEvent.click(plus());
    fireEvent.click(plus());
    expect(screen.getByText("4.50 h")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("Saving…");
    await act(async () => vi.advanceTimersByTime(399));
    expect(save).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTime(1));
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(todayLocal(), "deep-work", 4.5);
    expect(screen.getByRole("status").textContent).toBe("Saved");
    expect(deepWork().getAttribute("aria-label")).toBe("Career, Deep work, 4.5 hours");
  });

  it("saves 0 on Clear", async () => {
    const save = vi.fn<SaveEntry>().mockResolvedValue({ ok: true });
    renderDay(save);
    fireEvent.click(deepWork());
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    await act(async () => vi.advanceTimersByTime(400));
    expect(save).toHaveBeenCalledWith(todayLocal(), "deep-work", 0);
  });

  it("rolls back and shows a toast when the save fails", async () => {
    const save = vi.fn<SaveEntry>().mockRejectedValue(new Error("network"));
    renderDay(save);
    fireEvent.click(deepWork());
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
    fireEvent.click(deepWork());
    fireEvent.click(screen.getByRole("button", { name: "Add 8 hours" }));
    await act(async () => vi.advanceTimersByTime(400));
    expect(screen.getByText("4.00 h")).toBeTruthy();
    expect(screen.getByRole("alert")).toBeTruthy();
  });

  it("makes future days read-only", () => {
    const save = vi.fn<SaveEntry>();
    renderDay(save, "2999-01-01");
    fireEvent.click(deepWork());
    expect((plus() as HTMLButtonElement).disabled).toBe(true);
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
    fireEvent.click(deepWork());
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
    fireEvent.click(deepWork());
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
    expect(deepWork().getAttribute("aria-label")).toBe("Career, Deep work, 4.25 hours");
    expect(
      screen.getByRole("button", { name: /^Career, Meetings, / }).getAttribute("aria-label"),
    ).toBe("Career, Meetings, 3 hours");
    expect(
      screen.getByRole("button", { name: /^Health, Sleep, / }).getAttribute("aria-label"),
    ).toBe("Health, Sleep, 0 hours");
    await act(async () => vi.advanceTimersByTime(400));
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(date, "deep-work", 4.25);
    expect(deepWork().getAttribute("aria-label")).toBe("Career, Deep work, 4.25 hours");
  });

  it("does not flush debounced saves when only the save prop identity changes", async () => {
    const save = vi.fn<SaveEntry>().mockResolvedValue({ ok: true });
    const props = { date: todayLocal(), categories: PREVIEW_CATEGORIES, entries: PREVIEW_ENTRIES };
    const { rerender } = render(<DayView {...props} save={save} />);
    fireEvent.click(deepWork());
    fireEvent.click(plus());
    const save2 = vi.fn<SaveEntry>().mockResolvedValue({ ok: true });
    rerender(<DayView {...props} save={save2} />);
    expect(save).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTime(400));
    expect(save2).toHaveBeenCalledTimes(1);
  });

  it("puts the toast above the open sheet, and fixed at the bottom when closed", async () => {
    renderDay(vi.fn<SaveEntry>().mockRejectedValue(new Error("x")));
    fireEvent.click(deepWork());
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

  it("logs on a sub and on its main directly: both save, both count in the day total", async () => {
    const save = vi.fn<SaveEntry>().mockResolvedValue({ ok: true });
    const date = todayLocal();
    // An archived sub's entry: not on the wheel, but part of the day total.
    const entries = [...PREVIEW_ENTRIES, { categoryId: "archived-sub", hours: 1 }];
    render(<DayView date={date} categories={PREVIEW_CATEGORIES} entries={entries} save={save} />);
    expect(screen.getAllByRole("button", { name: /hours$/ })).toHaveLength(12); // 8 mains + 4 subs
    expect(wheel().textContent).toContain("18.5 h"); // 17.5 on the wheel + 1 archived

    fireEvent.click(deepWork());
    expect(title()).toBe("Career · Deep work");
    fireEvent.click(plus());

    fireEvent.click(screen.getByRole("button", { name: /^Career, general, / }));
    expect(title()).toBe("Career · general");
    expect(screen.getByText("0.00 h")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Add 1 hours" }));

    await act(async () => vi.advanceTimersByTime(400));
    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenCalledWith(date, "deep-work", 4.25);
    expect(save).toHaveBeenCalledWith(date, "career", 1);
    expect(deepWork().getAttribute("aria-label")).toBe("Career, Deep work, 4.25 hours");
    expect(
      screen.getByRole("button", { name: /^Career, general, / }).getAttribute("aria-label"),
    ).toBe("Career, general, 1 hours");
    expect(wheel().textContent).toContain("19.75 h");
  });
});
