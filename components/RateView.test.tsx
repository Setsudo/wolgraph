import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { PREVIEW_MAINS, PREVIEW_SCORES } from "@/app/dev/rate-preview/fixtures";
import type { SaveRating } from "@/lib/data/ratings";
import { addDays, todayLocal } from "@/lib/date";
import { SAVE_FAILED_MESSAGE } from "./DayView";
import { RateView, UNAVAILABLE_NOTICE } from "./RateView";

const DAY = "2026-10-15";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

beforeEach(() => vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] }));
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  push.mockReset();
});

function renderRate(save: SaveRating, available = true, day = DAY) {
  return render(
    <RateView
      day={day}
      mains={PREVIEW_MAINS}
      scores={PREVIEW_SCORES}
      available={available}
      save={save}
    />,
  );
}

// Sliders render twice (side columns from 768px, one list below); use the phone list.
const list = () => within(screen.getByTestId("rate-list"));
const slider = (name: string) => list().getByRole("slider", { name: `${name} rating` });
const value = (name: string) => (slider(name) as HTMLInputElement).value;
const move = (name: string, v: number) =>
  fireEvent.change(slider(name), { target: { value: String(v) } });

describe("RateView", () => {
  it("shows the day's score, else 0, on sliders and wheel", () => {
    renderRate(vi.fn<SaveRating>());
    expect(value("Health")).toBe("8");
    expect(value("Career")).toBe("0");
    expect(value("Personal Growth")).toBe("0");
    expect(screen.getByRole("img").getAttribute("aria-label")).toBe(
      "Life ratings: Health 8, Personal Growth 0, Finance 9, Family 7, Career 0, Relaxation 0, Relationships 0, Spirituality 0",
    );
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Wheel of Life");
    expect(screen.getByText("Thu, Oct 15")).toBeTruthy();
  });

  it("starts a day with no scores at 0 on every slider and saves nothing until one moves", async () => {
    // getRatings returns only the day's scores; earlier days' scores never reach the view.
    const save = vi.fn<SaveRating>().mockResolvedValue({ ok: true });
    render(<RateView day={DAY} mains={PREVIEW_MAINS} scores={{}} available save={save} />);
    for (const m of PREVIEW_MAINS) expect(value(m.name)).toBe("0");
    expect(screen.getByRole("img").getAttribute("aria-label")).toBe(
      `Life ratings: ${PREVIEW_MAINS.map((m) => `${m.name} 0`).join(", ")}`,
    );
    await act(async () => vi.advanceTimersByTime(1000));
    expect(save).not.toHaveBeenCalled();
    move("Career", 6);
    await act(async () => vi.advanceTimersByTime(400));
    expect(save.mock.calls).toEqual([["career", DAY, 6]]);
  });

  it("colours the wheel's dots and the sliders by category", () => {
    const { container } = renderRate(vi.fn<SaveRating>());
    const dots = [...container.querySelectorAll('[data-part="dot"]')];
    expect(dots.map((d) => d.getAttribute("fill"))).toEqual(PREVIEW_MAINS.map((m) => m.color));
    const input = slider("Career") as HTMLInputElement;
    expect(input.style.getPropertyValue("--thumb")).toBe("#C8553D");
  });

  it("has day arrows; next is disabled on today", () => {
    renderRate(vi.fn<SaveRating>(), true, todayLocal());
    expect((screen.getByRole("button", { name: "Next day" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    fireEvent.click(screen.getByRole("button", { name: "Previous day" }));
    expect(push).toHaveBeenLastCalledWith(`/rate?day=${addDays(todayLocal(), -1)}`);
  });

  it("navigates to the previous and next day from a past day", () => {
    renderRate(vi.fn<SaveRating>(), true, "2020-03-01");
    fireEvent.click(screen.getByRole("button", { name: "Previous day" }));
    expect(push).toHaveBeenLastCalledWith("/rate?day=2020-02-29");
    const next = screen.getByRole("button", { name: "Next day" }) as HTMLButtonElement;
    expect(next.disabled).toBe(false);
    fireEvent.click(next);
    expect(push).toHaveBeenLastCalledWith("/rate?day=2020-03-02");
  });

  it("uses onNavigate when given", () => {
    const onNavigate = vi.fn();
    render(
      <RateView
        day="2020-03-01"
        mains={PREVIEW_MAINS}
        scores={{}}
        available
        save={vi.fn<SaveRating>()}
        onNavigate={onNavigate}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Next day" }));
    expect(onNavigate).toHaveBeenCalledWith("2020-03-02");
    expect(push).not.toHaveBeenCalled();
  });

  it("sends a waiting change for its own day when moving to another day", async () => {
    const save = vi.fn<SaveRating>().mockResolvedValue({ ok: true });
    const { unmount } = renderRate(save, true, "2020-03-01");
    move("Health", 3);
    fireEvent.click(screen.getByRole("button", { name: "Previous day" }));
    unmount();
    expect(save).toHaveBeenCalledWith("health", "2020-03-01", 3);
  });

  it("puts the sliders in the side columns in wheel order", () => {
    renderRate(vi.fn<SaveRating>());
    const names = (id: string) =>
      within(screen.getByTestId(id))
        .getAllByRole("slider")
        .map((s) => s.getAttribute("aria-label")?.replace(" rating", ""));
    expect(names("rate-right")).toEqual(["Career", "Family", "Finance", "Personal Growth"]);
    expect(names("rate-left")).toEqual(["Relaxation", "Relationships", "Spirituality", "Health"]);
    expect(names("rate-list")).toEqual(PREVIEW_MAINS.map((m) => m.name));
  });

  it("debounces and saves only the moved category, with its last value", async () => {
    const save = vi.fn<SaveRating>().mockResolvedValue({ ok: true });
    renderRate(save);
    move("Career", 3);
    move("Career", 4);
    expect(value("Career")).toBe("4");
    expect(screen.getByRole("img").getAttribute("aria-label")).toContain("Career 4");
    expect(
      list()
        .getAllByRole("status")
        .map((s) => s.textContent),
    ).toContain("Saving…");
    await act(async () => vi.advanceTimersByTime(399));
    expect(save).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTime(1));
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith("career", DAY, 4);
    expect(
      list()
        .getAllByRole("status")
        .map((s) => s.textContent),
    ).toContain("Saved");
  });

  it("debounces each category separately", async () => {
    const save = vi.fn<SaveRating>().mockResolvedValue({ ok: true });
    renderRate(save);
    move("Health", 9);
    await act(async () => vi.advanceTimersByTime(200));
    move("Family", 1);
    await act(async () => vi.advanceTimersByTime(200));
    expect(save.mock.calls).toEqual([["health", DAY, 9]]);
    await act(async () => vi.advanceTimersByTime(200));
    expect(save.mock.calls).toEqual([
      ["health", DAY, 9],
      ["family", DAY, 1],
    ]);
  });

  it("rolls back and shows a toast when the save fails", async () => {
    const save = vi.fn<SaveRating>().mockRejectedValue(new Error("network"));
    renderRate(save);
    move("Personal Growth", 9);
    expect(value("Personal Growth")).toBe("9");
    await act(async () => vi.advanceTimersByTime(400));
    expect(value("Personal Growth")).toBe("0");
    expect(screen.getByRole("alert").textContent).toBe(SAVE_FAILED_MESSAGE);
    await act(async () => vi.advanceTimersByTime(4000));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("rolls back to the last saved value on an { ok: false } result", async () => {
    const save = vi
      .fn<SaveRating>()
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: false, message: "nope" });
    renderRate(save);
    move("Finance", 6);
    await act(async () => vi.advanceTimersByTime(400));
    move("Finance", 2);
    await act(async () => vi.advanceTimersByTime(400));
    expect(value("Finance")).toBe("6");
    expect(screen.getByRole("alert")).toBeTruthy();
  });

  it("keeps an unsettled change when fresh server data arrives", async () => {
    const save = vi.fn<SaveRating>().mockResolvedValue({ ok: true });
    const { rerender } = renderRate(save);
    move("Health", 2);
    rerender(
      <RateView
        day={DAY}
        mains={PREVIEW_MAINS}
        scores={{ ...PREVIEW_SCORES, career: 7 }}
        available
        save={save}
      />,
    );
    expect(value("Health")).toBe("2");
    expect(value("Career")).toBe("7");
  });

  it("when ratings are unavailable: shows the notice, moves the wheel, sends nothing", async () => {
    const save = vi.fn<SaveRating>();
    renderRate(save, false);
    const notice = screen.getByText(UNAVAILABLE_NOTICE);
    expect(notice.className).toContain("text-amber");
    expect(UNAVAILABLE_NOTICE).toBe(
      "Scores aren't saved yet: the ratings table hasn't been set up.",
    );
    move("Health", 1);
    expect(value("Health")).toBe("1");
    expect(screen.getByRole("img").getAttribute("aria-label")).toContain("Health 1");
    await act(async () => vi.advanceTimersByTime(1000));
    expect(save).not.toHaveBeenCalled();
    expect(
      list()
        .getAllByRole("status")
        .every((s) => s.textContent === ""),
    ).toBe(true);
  });

  it("renders with fewer than 3 mains, and with none", () => {
    const save = vi.fn<SaveRating>();
    const { rerender } = render(
      <RateView day={DAY} mains={PREVIEW_MAINS.slice(0, 2)} scores={{}} available save={save} />,
    );
    expect(list().getAllByRole("slider")).toHaveLength(2);
    expect(within(screen.getByTestId("rate-right")).getAllByRole("slider")).toHaveLength(1);
    expect(within(screen.getByTestId("rate-left")).getAllByRole("slider")).toHaveLength(1);
    rerender(<RateView day={DAY} mains={[]} scores={{}} available save={save} />);
    expect(screen.queryAllByRole("slider")).toHaveLength(0);
    expect(screen.getByRole("img").getAttribute("aria-label")).toBe("Life ratings: ");
  });

  it("has no notice when ratings are available", () => {
    renderRate(vi.fn<SaveRating>());
    expect(screen.queryByText(UNAVAILABLE_NOTICE)).toBeNull();
  });
});
