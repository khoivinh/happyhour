import { test, expect } from "@playwright/test";
import { blockExternal, seedZones } from "./helpers";

/** The "Time Zone Names" preference swaps each tile's GMT-offset label (GMT+1) for a named
 *  abbreviation (CET) where one is known, and leaves the rest as GMT. It ships default-ON, so the
 *  first assertion is the out-of-the-box state, not a toggled one. Abbreviations are asserted with
 *  season-agnostic regexes (CET|CEST, EST|EDT) so the run doesn't flake across DST. No `\b` anchors:
 *  Playwright joins a tile's text nodes without separators ("...PMCESTCEST"), so word boundaries
 *  never match — a plain substring is the reliable check here. */
test.describe("Time Zone Names toggle", () => {
  test.beforeEach(async ({ page }) => {
    await blockExternal(page);
    // Paris → curated table (CET/CEST); Mumbai → IST (no DST); New York → Intl fallback (EST/EDT).
    await page.addInitScript(seedZones(["paris_FR", "mumbai_IN", "newYorkCity_US"]));
    await page.goto("/");
  });

  test("defaults on: tiles show the abbreviation, not the GMT offset", async ({ page }) => {
    const paris = page.getByTestId("draggable-zone-paris_FR");
    await expect(paris).toBeVisible();
    await expect(paris).toContainText(/CES?T/);
    await expect(paris).not.toContainText(/GMT[+-]/);
    await expect(page.getByTestId("draggable-zone-mumbai_IN")).toContainText(/IST/);
    await expect(page.getByTestId("draggable-zone-newYorkCity_US")).toContainText(/E[SD]T/);
  });

  test("toggling off reverts every covered tile to the GMT offset", async ({ page }) => {
    await page.getByTestId("button-drawer-toggle").click();
    const toggle = page
      .getByText("Time Zone Names", { exact: true })
      .locator("xpath=..")
      .getByRole("switch");
    // Confirms the default-ON state is reflected in the control, not just the tiles.
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "false");

    const paris = page.getByTestId("draggable-zone-paris_FR");
    await expect(paris).toContainText(/GMT[+-]/);
    await expect(paris).not.toContainText(/CES?T/);
  });
});
