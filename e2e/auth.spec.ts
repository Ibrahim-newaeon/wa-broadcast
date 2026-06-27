import { test, expect } from "@playwright/test";

// Authenticated smoke test. Requires the same ADMIN_EMAIL / password as the
// running app, provided via E2E_EMAIL / E2E_PASSWORD. Skips if not set so CI
// without secrets stays green.
const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

test.describe("Authenticated dashboard", () => {
  test.skip(!email || !password, "set E2E_EMAIL and E2E_PASSWORD to run");

  test("log in and load dashboard", async ({ page }) => {
    await page.goto("/login");
    await page.getByTestId("login-email").fill(email!);
    await page.getByTestId("login-password").fill(password!);
    await page.getByTestId("login-submit").click();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { name: "WhatsApp Broadcast Console" })).toBeVisible();
    await expect(page.getByTestId("broadcasts-table")).toBeVisible();
  });
});
