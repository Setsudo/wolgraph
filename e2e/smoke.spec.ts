import { expect, test } from "@playwright/test";

test("trends page renders the main nav", async ({ page }) => {
  await page.goto("/trends");
  const nav = page.getByRole("navigation", { name: "Main" });
  await expect(nav.getByRole("link", { name: "Day" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Trends" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Categories" })).toBeVisible();
});
