import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { MainAggregate, PeriodAggregate } from "@/lib/data/aggregates";
import { periodFor } from "@/lib/data/period";
import { Radar } from "./Radar";
import { FEW_MAINS_NOTE, TrendsBody } from "./trends/TrendsBody";

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

describe("Radar", () => {
  it("renders one data polygon, one dot and one label per main", () => {
    const { container } = render(<Radar mains={MAINS} />);
    expect(container.querySelectorAll('[data-part="data"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-part="dot"]')).toHaveLength(4);
    expect(container.querySelectorAll('[data-part="label"]')).toHaveLength(4);
    expect(container.querySelectorAll('[data-part="axis"]')).toHaveLength(4);
  });

  it("crops the viewBox to the web plus top and bottom label bands", () => {
    const { container } = render(<Radar mains={MAINS} />);
    // SIZE 400, radius 128: y from 200 - 128 - 36 = 36, height 2 * 128 + 72 = 328.
    expect(container.querySelector("svg")?.getAttribute("viewBox")).toBe("0 36 400 328");
  });

  it("places ring scale labels off the 12 o'clock axis", () => {
    const { container } = render(<Radar mains={MAINS} />);
    const rings = [...container.querySelectorAll('[data-part="ring-label"]')];
    expect(rings.map((t) => t.textContent)).toEqual(["2h", "4h", "6h"]);
    for (const t of rings) {
      expect(Number(t.getAttribute("x"))).toBeGreaterThan(200);
      expect(t.getAttribute("text-anchor")).toBe("start");
    }
  });

  it("summarizes averages in its aria-label", () => {
    render(<Radar mains={MAINS} />);
    expect(
      screen.getByRole("img", {
        name: "Average hours per day: Health 2.5, Career 6, Family 1.25, Old 1",
      }),
    ).toBeTruthy();
  });

  it("marks archived categories in italic with a suffix", () => {
    const { container } = render(<Radar mains={MAINS} />);
    const labels = [...container.querySelectorAll('[data-part="label"]')];
    const archived = labels.find((l) => l.textContent === "Old (archived)");
    expect(archived?.getAttribute("font-style")).toBe("italic");
    expect(labels[0].textContent).toBe("Health");
    expect(labels[0].getAttribute("font-style")).toBeNull();
  });
});

describe("TrendsBody", () => {
  it("shows the note and table but no radar with fewer than 3 mains", () => {
    render(<TrendsBody aggregate={aggregate(MAINS.slice(0, 2))} />);
    expect(screen.getByText(FEW_MAINS_NOTE)).toBeTruthy();
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByRole("table")).toBeTruthy();
    expect(screen.getByText("Days logged: 5 of 7")).toBeTruthy();
  });

  it("shows the radar and no note with 3 or more mains", () => {
    render(<TrendsBody aggregate={aggregate(MAINS)} />);
    expect(screen.queryByText(FEW_MAINS_NOTE)).toBeNull();
    expect(screen.getByRole("img")).toBeTruthy();
    expect(screen.getByText("17.5 h")).toBeTruthy();
  });

  it("shows the empty state for an empty period", () => {
    render(<TrendsBody aggregate={aggregate(MAINS, 0)} />);
    expect(screen.getByText("No hours logged this week.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Log today" }).getAttribute("href")).toBe("/");
    expect(screen.queryByRole("table")).toBeNull();
  });
});
