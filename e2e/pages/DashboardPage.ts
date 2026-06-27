import { Page, Locator, expect } from "@playwright/test";

// Page Object Model — encapsulates dashboard selectors & actions.
export class DashboardPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly broadcastsTable: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole("heading", { name: "WhatsApp Broadcast Console" });
    this.broadcastsTable = page.locator('[data-test-id="broadcasts-table"]');
  }

  async goto() {
    await this.page.goto("/");
  }

  async expectLoaded() {
    await expect(this.heading).toBeVisible();
    await expect(this.broadcastsTable).toBeVisible();
  }
}
