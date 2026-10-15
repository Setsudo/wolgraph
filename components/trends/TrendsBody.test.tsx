import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { MainAggregate, PeriodAggregate } from "@/lib/data/aggregates";
import { periodFor } from "@/lib/data/period";
import { FEW_MAINS_NOTE, TrendsBody } from "./TrendsBody";

afterEach(cleanup);

function main(name: string, average: number, archived = false): MainAggregate {
  return { mainId: name, name, color: "#2F8C8C", archived, total: average * 7, average };
}

const MAINS = [main("Health", 2.5), main("Career", 6), main("Family", 1.25), main("Old", 1, true)];

function aggregate(mains: MainAggregate[], days = 5): PeriodAggregate {
  return {
    period: periodFor("week", "2026-10-15"),
    daysWithEntries: days,
    mains,
    isEmpty: days === 0,
  };
}

const parts = (c: HTMLElement, part: string) => [...c.querySelectorAll(`[data-part="${part}"]`)];

describe("TrendsBody", () => {
  it("shows the note and table but no wheel with fewer than 3 mains", () => {
    render(<TrendsBody aggregate={aggregate(MAINS.slice(0, 2))} />);
    expect(FEW_MAINS_NOTE).toBe("Add at least 3 categories to see the wheel.");
    expect(screen.getByText(FEW_MAINS_NOTE)).toBeTruthy();
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByRole("table")).toBeTruthy();
    expect(screen.getByText("Days logged: 5 of 7")).toBeTruthy();
  });

  it("shows the life wheel of averages and no note with 3 or more mains", () => {
    const { container } = render(<TrendsBody aggregate={aggregate(MAINS)} />);
    expect(screen.queryByText(FEW_MAINS_NOTE)).toBeNull();
    expect(
      screen.getByRole("img", {
        name: "Average hours per day: Health 2.5, Career 6, Family 1.25, Old 1",
      }),
    ).toBeTruthy();
    expect(parts(container, "spoke")).toHaveLength(4);
    // max = scaleMax([2.5, 6, 1.25, 1]) = 6, rings every 2 h.
    expect(parts(container, "ring-label").map((t) => t.textContent)).toEqual(["2h", "4h", "6h"]);
    expect(screen.getByText("17.5 h")).toBeTruthy();
  });

  it("labels archived mains with a suffix, in italic", () => {
    const { container } = render(<TrendsBody aggregate={aggregate(MAINS)} />);
    const labels = parts(container, "label");
    expect(labels.map((l) => l.textContent)).toEqual([
      "HEALTH",
      "CAREER",
      "FAMILY",
      "OLD (ARCHIVED)",
    ]);
    expect(labels[3].getAttribute("font-style")).toBe("italic");
    expect(labels[0].getAttribute("font-style")).toBeNull();
  });

  it("shows the empty state for an empty period", () => {
    render(<TrendsBody aggregate={aggregate(MAINS, 0)} />);
    expect(screen.getByText("No hours logged this week.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Log today" }).getAttribute("href")).toBe("/day");
    expect(screen.queryByRole("table")).toBeNull();
  });
});
