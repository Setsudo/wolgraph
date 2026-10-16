import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { addDays, todayLocal } from "@/lib/date";
import { RateTodayGate } from "./RateTodayGate";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

afterEach(() => {
  cleanup();
  replace.mockReset();
});

const gate = (day: string | null) =>
  render(
    <RateTodayGate day={day}>
      <p>Rate screen</p>
    </RateTodayGate>,
  );

describe("RateTodayGate", () => {
  it("renders today without redirecting", () => {
    gate(todayLocal());
    expect(screen.getByText("Rate screen")).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
  });

  it("renders a past day without redirecting", () => {
    gate(addDays(todayLocal(), -30));
    expect(screen.getByText("Rate screen")).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
  });

  it("redirects a future day to the local today", () => {
    gate(addDays(todayLocal(), 1));
    expect(screen.queryByText("Rate screen")).toBeNull();
    expect(replace).toHaveBeenCalledWith(`/rate?day=${todayLocal()}`);
  });

  it("redirects a missing or invalid day to the local today", () => {
    gate(null);
    expect(screen.queryByText("Rate screen")).toBeNull();
    expect(replace).toHaveBeenCalledWith(`/rate?day=${todayLocal()}`);
    cleanup();
    replace.mockReset();
    gate("2026-02-30");
    expect(screen.queryByText("Rate screen")).toBeNull();
    expect(replace).toHaveBeenCalledWith(`/rate?day=${todayLocal()}`);
  });
});
