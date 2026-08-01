import { test, expect, type Page } from "@playwright/test";
import { blockExternal, seedZones } from "./helpers";

/** The custom-time editor on the hero clock: how it commits, and how it backs out.
 *
 *  There is deliberately no minute-granularity constraint here. A `step` attribute was tried and
 *  removed (2026-08-01): `step` on a time input is a *validity* rule, not a picker rule — iOS
 *  Safari's wheel never receives it, and Chromium closed the matching request Won't Fix. Enforcing
 *  five-minute increments would have meant rounding a typed value or hand-building the control,
 *  and neither was worth it. See the devlog. */

const editor = (page: Page) => page.getByTestId("input-edit-time");
const heroTime = (page: Page) => page.getByTestId("text-hero-time");

async function openEditor(page: Page) {
  await blockExternal(page);
  await page.goto("/");
  await page.locator("#stcm-banner").getByRole("button", { name: "Accept all" }).click();
  await expect(page.locator("#stcm-banner")).toBeHidden();
  await heroTime(page).click();
  await expect(editor(page)).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  // The hero clock renders seconds while it's live, so any assertion that reads its text twice
  // races the wall clock. Pinning Date.now() makes the display constant — without it, "the clock
  // is unchanged after Escape" fails whenever the two reads straddle a second boundary.
  await page.clock.setFixedTime(new Date("2026-08-01T12:00:00Z"));
  await page.addInitScript(seedZones(["tokyo_JP", "paris_FR"]));
});

test("Return commits the edit and closes the editor", async ({ page }) => {
  await openEditor(page);
  await editor(page).fill("05:15");
  await editor(page).press("Enter");

  await expect(editor(page)).toBeHidden();
  await expect(heroTime(page)).toContainText("5:15");
  // Committing a custom time is what reveals Reset Time — proof the value reached the page, not
  // just the tile's own display state.
  await expect(page.getByTestId("button-reset-time")).toBeVisible();
});

test("Escape abandons the edit, leaving the clock untouched", async ({ page }) => {
  await blockExternal(page);
  await page.goto("/");
  await page.locator("#stcm-banner").getByRole("button", { name: "Accept all" }).click();
  await expect(page.locator("#stcm-banner")).toBeHidden();
  // Read the clock *before* opening the editor — the editor replaces the time display, so this
  // locator doesn't resolve while it's open.
  const before = await heroTime(page).textContent();
  await heroTime(page).click();
  await expect(editor(page)).toBeVisible();

  await editor(page).fill("05:15");
  await editor(page).press("Escape");

  await expect(editor(page)).toBeHidden();
  await expect(heroTime(page)).toHaveText(before!);
  // Nothing was committed, so the board never entered custom mode.
  await expect(page.getByTestId("button-reset-time")).toBeHidden();
});

test("Escape in the editor does not also tear down share select-mode", async ({ page }) => {
  // The regression this guards: share mode's Escape handler is on `document`, so an un-stopped
  // Escape from the editor would close the editor *and* drop the share bar in one keystroke.
  await blockExternal(page);
  await page.goto("/");
  await page.locator("#stcm-banner").getByRole("button", { name: "Accept all" }).click();
  await page.getByTestId("button-tile-menu-tokyo_JP").click();
  await page.getByTestId("menu-share-tokyo_JP").click();
  await expect(page.getByTestId("share-selection-bar")).toBeVisible();

  await heroTime(page).click();
  await expect(editor(page)).toBeVisible();
  await editor(page).press("Escape");

  await expect(editor(page)).toBeHidden();
  await expect(page.getByTestId("share-selection-bar")).toBeVisible();

  // …and a second Escape, now that the editor is gone, still exits share mode as it always did.
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("share-selection-bar")).toBeHidden();
});

test("any minute is settable — the editor imposes no granularity", async ({ page }) => {
  // Guards the 2026-08-01 decision to drop the five-minute constraint rather than enforce it in
  // our own code. If a future change starts snapping typed values, this should fail and be a
  // conscious call, not a side effect.
  await openEditor(page);
  await editor(page).fill("05:03");
  await editor(page).press("Enter");

  await expect(heroTime(page)).toContainText("5:03");
});
