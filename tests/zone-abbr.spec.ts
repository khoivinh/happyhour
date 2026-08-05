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

/** The relative-time badge is taller than the bare zone label it sits beside (its own line-height
 *  plus a 1px border top and bottom). Without a floor on the row, mounting the badge grew the row
 *  and items-center nudged the zone label down a pixel — so toggling Relative Time made every tile
 *  on the board twitch. The row now carries a min-height equal to the badge, and this pins it. */
test.describe("the tile meta line", () => {
  /** Spans enough of the globe that at least one city always shares the local day, whatever the
   *  runner's timezone — the transition under test only happens on a tile with *no* badge, and a
   *  tile already carrying NEXT DAY/PREV DAY would pass trivially without exercising anything. */
  const SPREAD = [
    "losAngeles_US",
    "newYorkCity_US",
    "london_GB",
    "paris_FR",
    "tokyo_JP",
    "sydney_AU",
  ];

  test("holds its position when the relative-time badge appears", async ({ page }) => {
    await blockExternal(page);
    await page.addInitScript(seedZones(SPREAD));
    await page.goto("/");

    // Relative Time is off at rest, so the only badge that can be up now is a day indicator.
    // Find a tile without one — that's the tile whose row grows when the badge arrives.
    const bare = page
      .locator('[data-testid^="draggable-zone-"]')
      .filter({ hasNotText: /NEXT DAY|PREV DAY/ })
      .first();
    await expect(bare).toBeVisible();
    await expect(bare).not.toContainText(/HR/);

    // The row itself, not any text inside it: the <p>'s own y never moves — it's the row's
    // *height* that grows (16px → 18px), which re-centres the label a pixel lower. Measuring the
    // label via getByText silently matches the <p> ancestor and would pass against the bug.
    const row = bare.locator('[data-testid^="tile-meta-"]');
    const label = row.locator("span").first();
    const before = { row: await row.boundingBox(), label: await label.boundingBox() };

    await page.getByTestId("button-drawer-toggle").click();
    const toggle = page
      .getByText("Relative Time", { exact: true })
      .locator("xpath=..")
      .getByRole("switch");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    // The badge is what changes the row's content; wait for it rather than racing the re-render.
    await expect(bare).toContainText(/HR/);

    // Mutation-checked: drop min-h from the row and both of these fail — height 16 → 18, label
    // y + 1.
    expect((await row.boundingBox())!.height).toBeCloseTo(before.row!.height, 0);
    expect((await label.boundingBox())!.y).toBeCloseTo(before.label!.y, 0);
  });
});
