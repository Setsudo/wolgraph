import { describe, expect, it, vi } from "vitest";

const redirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT ${url}`);
});
const replace = vi.fn();
vi.mock("next/navigation", () => ({ redirect, useRouter: () => ({ replace }) }));

const { default: Home } = await import("./page");
const { default: DayIndex } = await import("./(app)/day/page");
const { render } = await import("@testing-library/react");
const { todayLocal } = await import("@/lib/date");

describe("root redirect", () => {
  it("sends / to /rate", () => {
    expect(() => Home()).toThrow(/NEXT_REDIRECT/);
    expect(redirect).toHaveBeenCalledWith("/rate");
  });

  it("sends /day to today's local day page", () => {
    render(<DayIndex />);
    expect(replace).toHaveBeenCalledWith(`/day/${todayLocal()}`);
  });
});
