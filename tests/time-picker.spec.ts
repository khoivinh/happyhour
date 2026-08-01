import { test, expect, type Page } from "@playwright/test";
import { blockExternal, seedZones } from "./helpers";

/** The custom-time editor on the hero clock: how it steps, and how it commits.
 *
 *  `step` is asserted as an attribute rather than by driving the picker — the native wheel and the
 *  arrow-key behaviour it controls live in the browser, not in our code, so pinning the attribute
 *  is what actually guards the intent. A directly-typed off-step value is deliberately *not*
 *  rejected, and there's a test below to keep that from being "fixed" by accident. */

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
  await page.addInitScript(seedZones(["tokyo_JP", "paris_FR"]));
});

test("the time inputs step in five-minute jumps", async ({ page }) => {
  await openEditor(page);
  // 300s = 5min. Also keeps the browser from growing a seconds field (any step >= 60 does).
  await expect(editor(page)).toHaveAttribute("step", "300");
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

test("a typed off-step value is left alone, not rounded", async ({ page }) => {
  // Deliberate: `step` shapes the picker, it doesn't police typing. Someone who types 5:03 means
  // 5:03. Asserted so a later "let's snap it to the nearest five" change is a conscious one.
  await openEditor(page);
  await editor(page).fill("05:03");
  await editor(page).press("Enter");

  await expect(heroTime(page)).toContainText("5:03");
});
