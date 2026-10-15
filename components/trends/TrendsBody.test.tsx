import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { periodFor } from "@/lib/data/period";
import type { TrendAggregate, TrendMain } from "@/lib/data/ratingAggregates";
import {
  FEW_MAINS_NOTE,
  NO_RATINGS,
  RATINGS_UNAVAILABLE,
  RATING_HEADING,
  TIME_HEADING,
  TrendsBody,
} from "./TrendsBody";

afterEach(cleanup);

function main(
  name: string,
  average: number,
  archived = false,
  averageRating: number | null = null,
  color = "#2F8C8C",
): TrendMain {
  return { mainId: name, name, color, archived, total: average * 7, average, averageRating };
}

const MAINS = [main("Health", 2.5), main("Career", 6), main("Family", 1.25), main("Old", 1, true)];
const RATED = [
  main("Health", 2.5, false, 7.5, "#2F8C8C"),
  main("Career", 6, false, 5, "#C8553D"),
  main("Family", 1.25, false, null, "#C9831F"),
  main("Old", 1, true, 8.3, "#7A5BA8"),
];

function aggregate(
  mains: TrendMain[],
  days = 5,
  ratings: { ratingsEmpty?: boolean; ratingsAvailable?: boolean } = {},
): TrendAggregate {
  return {
    period: periodFor("week", "2026-10-15"),
    daysWithEntries: days,
    mains,
    isEmpty: days === 0,
    ratingsEmpty: ratings.ratingsEmpty ?? mains.every((m) => m.averageRating === null),
    ratingsAvailable: ratings.ratingsAvailable ?? true,
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
    // No ratings: only the hours wheel is drawn.
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

  it("titles the Time and Rating charts", () => {
    render(<TrendsBody aggregate={aggregate(RATED)} />);
    const headings = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(headings).toEqual([TIME_HEADING, RATING_HEADING]);
    expect(TIME_HEADING).toBe("Time · avg hours per day");
    expect(RATING_HEADING).toBe("Rating · avg score 0-10");
  });

  it("draws the rating wheel on 0-10 with the same sectors and colours, unrated at the centre", () => {
    const { container } = render(<TrendsBody aggregate={aggregate(RATED)} />);
    const wheels = screen.getAllByRole("img");
    expect(wheels).toHaveLength(2);
    const [time, rating] = wheels;
    expect(rating.getAttribute("aria-label")).toBe(
      "Average rating out of 10: Health 7.5, Career 5.0, Family n/a, Old 8.3",
    );
    const inWheel = (svg: Element, part: string) => [
      ...svg.querySelectorAll(`[data-part="${part}"]`),
    ];
    expect(inWheel(rating, "ring-label").map((t) => t.textContent)).toEqual([
      "2",
      "4",
      "6",
      "8",
      "10",
    ]);
    expect(inWheel(rating, "label").map((l) => l.textContent)).toEqual(
      inWheel(time, "label").map((l) => l.textContent),
    );
    const fills = (svg: Element) => inWheel(svg, "dot").map((d) => d.getAttribute("fill"));
    expect(fills(rating)).toEqual(["#2F8C8C", "#C8553D", "#C9831F", "#7A5BA8"]);
    expect(fills(time)).toEqual(fills(rating));
    // Family (null) sits on the centre of the wheel.
    const family = inWheel(rating, "dot")[2];
    const boundary = inWheel(rating, "boundary")[0];
    expect(family.getAttribute("cx")).toBe(boundary.getAttribute("cx"));
    expect(family.getAttribute("cy")).toBe(boundary.getAttribute("cy"));
    expect(parts(container, "spoke")).toHaveLength(8);
  });

  it("shows the rating empty state in place of the wheel when the period has no ratings", () => {
    render(<TrendsBody aggregate={aggregate(MAINS)} />);
    expect(NO_RATINGS).toBe("No ratings in this period.");
    expect(screen.getByText(NO_RATINGS)).toBeTruthy();
    expect(screen.getByRole("heading", { name: RATING_HEADING })).toBeTruthy();
    expect(screen.getAllByRole("img")).toHaveLength(1);
    expect(screen.queryByText(RATINGS_UNAVAILABLE)).toBeNull();
  });

  it("says ratings aren't set up when the ratings table is missing", () => {
    render(
      <TrendsBody
        aggregate={aggregate(MAINS, 5, { ratingsEmpty: true, ratingsAvailable: false })}
      />,
    );
    expect(RATINGS_UNAVAILABLE).toBe("Ratings aren't set up yet.");
    expect(screen.getByText(RATINGS_UNAVAILABLE)).toBeTruthy();
    expect(screen.queryByText(NO_RATINGS)).toBeNull();
    expect(screen.getAllByRole("img")).toHaveLength(1);
  });

  it("adds an Avg rating column after Avg / day, n/a when unrated", () => {
    render(<TrendsBody aggregate={aggregate(RATED)} />);
    expect(screen.getAllByRole("columnheader").map((h) => h.textContent)).toEqual([
      "Category",
      "Total",
      "Avg / day",
      "Avg rating",
    ]);
    const cells = (name: string) =>
      [...screen.getByRole("row", { name: new RegExp(`^${name}`) }).querySelectorAll("td")].map(
        (c) => c.textContent,
      );
    expect(cells("Health")[2]).toBe("7.5");
    expect(cells("Career")[2]).toBe("5.0");
    const na = screen.getByRole("row", { name: /^Family/ }).querySelectorAll("td")[2];
    expect(na.textContent).toBe("n/a");
    expect(na.querySelector("span")?.className).toContain("text-navy/60");
  });

  it("empty hours period: no rating column or wheel either", () => {
    render(<TrendsBody aggregate={aggregate(RATED, 0)} />);
    expect(screen.getByText("No hours logged this week.")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: RATING_HEADING })).toBeNull();
  });
});
