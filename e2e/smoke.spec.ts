import { expect, test } from "@playwright/test";

// These run without Supabase credentials: every visitor is signed out.

test("login page renders the sign-in form", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Wheel of Life" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByRole("button", { name: "Send link" })).toBeVisible();
});

test("trends without a session ends on login", async ({ page }) => {
  await page.goto("/trends");
  await expect(page).toHaveURL(/\/login\?next=%2Ftrends$/);
  await expect(page.getByRole("heading", { name: "Wheel of Life" })).toBeVisible();
});

test("/ goes to today's day page, then to login without a session", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login\?next=%2Fday%2F\d{4}-\d{2}-\d{2}$/);
});
