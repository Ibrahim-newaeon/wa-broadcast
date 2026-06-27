import { test, expect, request } from "@playwright/test";

// These tests cover public endpoints + the auth gate WITHOUT needing seeded
// credentials. For authenticated flows (upload/broadcast), log in first and
// reuse storageState — see e2e/auth.spec.ts.

test.describe("Public surface & auth gate", () => {
  // POSITIVE: health endpoint is public
  test("health endpoint returns ok", async ({ baseURL }) => {
    const ctx = await request.newContext();
    const res = await ctx.get(`${baseURL}/api/health`);
    expect(res.ok()).toBeTruthy();
    expect((await res.json()).status).toBe("ok");
  });

  // POSITIVE: login page renders
  test("login page renders form", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByTestId("login-submit")).toBeVisible();
  });

  // NEGATIVE: unauthenticated dashboard redirects to /login
  test("dashboard redirects to login when unauthenticated", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
  });

  // NEGATIVE: protected API returns 401 without a session
  test("protected API → 401 unauthenticated", async ({ baseURL }) => {
    const ctx = await request.newContext();
    const res = await ctx.post(`${baseURL}/api/broadcasts`, { data: {} });
    expect(res.status()).toBe(401);
  });

  // NEGATIVE: broadcast detail API requires auth
  test("broadcast detail API → 401 unauthenticated", async ({ baseURL }) => {
    const ctx = await request.newContext();
    const res = await ctx.get(`${baseURL}/api/broadcasts/does-not-exist`);
    expect(res.status()).toBe(401);
  });

  // NEGATIVE: retry action requires auth
  test("retry action → 401 unauthenticated", async ({ baseURL }) => {
    const ctx = await request.newContext();
    const res = await ctx.post(`${baseURL}/api/broadcasts/x/retry`);
    expect(res.status()).toBe(401);
  });

  // NEGATIVE: logout-all requires auth
  test("logout-all → 401 unauthenticated", async ({ baseURL }) => {
    const ctx = await request.newContext();
    const res = await ctx.post(`${baseURL}/api/auth/logout-all`);
    expect(res.status()).toBe(401);
  });

  // NEGATIVE: webhook POST without a valid signature → 401 (public route, still verified)
  test("webhook without signature → 401", async ({ baseURL }) => {
    const ctx = await request.newContext();
    const res = await ctx.post(`${baseURL}/api/webhooks/whatsapp`, {
      data: { object: "whatsapp_business_account", entry: [] },
    });
    expect(res.status()).toBe(401);
  });

  // NEGATIVE: bad credentials are rejected
  test("login with bad credentials → 401", async ({ baseURL }) => {
    const ctx = await request.newContext();
    const res = await ctx.post(`${baseURL}/api/auth/login`, {
      data: { email: "nope@example.com", password: "wrong" },
    });
    expect([401, 429]).toContain(res.status());
  });
});
