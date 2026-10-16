import { describe, expect, it } from "vitest";
import { FIXTURE_CATEGORIES } from "@/app/dev/categories-preview/fakeCategories";
import {
  defaultMainColor,
  nextSortOrder,
  PALETTE,
  validateCategoryName,
  validateName,
} from "./categoryRules";

describe("categoryRules", () => {
  it("validates trimmed length 1-40", () => {
    expect(validateName("  ")).toBe("Enter a name.");
    expect(validateName("a".repeat(41))).toBe("Use 40 characters or fewer.");
    expect(validateName(` ${"a".repeat(40)} `)).toBeNull();
  });

  it("checks duplicates among active siblings only, excluding self", () => {
    expect(validateCategoryName(FIXTURE_CATEGORIES, "health", "SLEEP")).toBe(
      "A category with this name already exists.",
    );
    expect(validateCategoryName(FIXTURE_CATEGORIES, "health", "sleep", "sleep")).toBeNull();
    expect(validateCategoryName(FIXTURE_CATEGORIES, null, "Hobbies")).toBeNull();
    expect(validateCategoryName(FIXTURE_CATEGORIES, "career", "side project")).toBeNull();
    expect(validateCategoryName(FIXTURE_CATEGORIES, null, "sleep")).toBeNull();
  });

  it("picks the first palette color unused by an active main", () => {
    expect(defaultMainColor(FIXTURE_CATEGORIES)).toBe(PALETTE[0]);
    const withoutFinance = FIXTURE_CATEGORIES.filter((c) => c.id !== "finance");
    expect(defaultMainColor(withoutFinance)).toBe("#3E8E4F");
    expect(defaultMainColor([])).toBe(PALETTE[0]);
  });

  it("next sort order is max + 1, or 0", () => {
    expect(nextSortOrder([])).toBe(0);
    expect(nextSortOrder([{ sort_order: 3 }, { sort_order: 8 }])).toBe(9);
  });
});
