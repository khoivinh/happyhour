import { test, expect } from "@playwright/test";
import { blockExternal, seedZones, siteFooter } from "./helpers";

/** wouter swaps routes in place and leaves the scroll offset untouched, so a link at the bottom of
 *  the tall home page used to land the next route scrolled to its own footer — worst on mobile, and
 *  exactly what happens with the footer's "access your location" → /support link. App.tsx now resets
 *  scroll on every route change; this holds it to that. */
test.describe("route navigation scrolls to top", () => {
  test("opening Support from the footer lands at the top, not the footer", async ({ page }) => {
    await blockExternal(page);
    // A full board so the home page is comfortably taller than the viewport.
    await page.addInitScript(
      seedZones([
        "tokyo_JP", "paris_FR", "london_GB", "newYorkCity_US", "sydney_AU",
        "losAngeles_US", "berlin_DE", "mumbai_IN", "saoPaulo_BR",
      ])
    );
    await page.goto("/");
    await page.locator("#stcm-banner").getByRole("button", { name: "Accept all" }).click();
    await expect(page.locator("#stcm-banner")).toBeHidden();

    // The link renders only when geolocation is denied (Playwright's default) and sits at the very
    // bottom — reaching it means scrolling down.
    const link = siteFooter(page).getByRole("link", { name: "access your location" });
    await link.scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);

    await link.click();
    await expect(page).toHaveURL(/\/support$/);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  });
});
