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
