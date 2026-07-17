import { test, expect, type Page } from "@playwright/test";
import { blockExternal, seedZones, trackedEvents } from "./helpers";

/** The sending end of the share flow: the commit bar's two ways out.
 *
 *  Copy Link always renders; Share only where `navigator.share` exists. Whether a browser has a
 *  share sheet is not a question of screen width — desktop Chrome and Edge open one, desktop
 *  Safari and Firefox don't — so both shapes are pinned explicitly here rather than left to
 *  whatever the test browser happens to expose. */

const bar = (page: Page) => page.getByTestId("share-selection-bar");

/** Pin `navigator.share` on or off before the app boots, and record any invocation so the test
 *  can tell "opened the sheet" from "copied to the clipboard". */
function pinShareSheet(present: boolean) {
  return `
    window.__shared = [];
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: ${present} ? (data) => { window.__shared.push(data); return Promise.resolve(); } : undefined,
    });
  `;
}

async function enterSelectMode(page: Page, seed: string[], shareSheet: boolean) {
  await page.addInitScript(seedZones(seed));
  await page.addInitScript(pinShareSheet(shareSheet));
  await page.goto("/");
  await page.locator("#stcm-banner").getByRole("button", { name: "Accept all" }).click();
  await expect(page.locator("#stcm-banner")).toBeHidden();
  await page.getByTestId(`button-tile-menu-${seed[0]}`).click();
  await page.getByTestId(`menu-share-${seed[0]}`).click();
  await expect(bar(page)).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await blockExternal(page);
  // Copy Link's inline "Copied" restores itself on a 3s timer, so asserting it races a wall clock
  // under contention. install() alone does NOT stop time (it ticks along with it) — pauseAt is what
  // freezes timers. Aim ahead of "now": the fake clock ticks between the two calls, and pauseAt
  // rejects a time already in its past. Nothing is scheduled yet, so the jump fires nothing.
  await page.clock.install();
  await page.clock.pauseAt(Date.now() + 60_000);
});

test.describe("with a native share sheet", () => {
  test("offers Copy Link alongside Share", async ({ page }) => {
    await enterSelectMode(page, ["tokyo_JP", "paris_FR"], true);

    await expect(page.getByTestId("button-share-copy")).toBeVisible();
    await expect(page.getByTestId("button-share-commit")).toBeVisible();
    await expect(page.getByTestId("button-share-commit")).toHaveText("Share 1");
  });

  test("Share hands the link to the sheet and leaves the bar up", async ({ page }) => {
    await enterSelectMode(page, ["tokyo_JP", "paris_FR"], true);
    await page.getByTestId("button-share-commit").click();

    const shared = await page.evaluate(() => (window as any).__shared);
    expect(shared).toHaveLength(1);
    expect(shared[0].url).toMatch(/\/\?z=tokyo_JP$/);
    expect(await trackedEvents(page, "share_committed")).toEqual([{ count: 1, method: "native" }]);
    // The bar is stable after the sheet returns — the user may want to copy the link too, or
    // share again, so yanking the selection out from under them is exactly what we removed.
    await expect(bar(page)).toBeVisible();
  });
});

test.describe("without a native share sheet", () => {
  test("Copy Link takes the primary slot and Share is gone", async ({ page }) => {
    await enterSelectMode(page, ["tokyo_JP", "paris_FR"], false);

    await expect(page.getByTestId("button-share-copy")).toBeVisible();
    // Share would only have copied to the clipboard here — one action wearing two buttons.
    await expect(page.getByTestId("button-share-commit")).toHaveCount(0);
  });
});

/** Both of these guard the same failure: a border class that generates no rule, or loses to one,
 *  and silently falls back to something nobody chose. Neither the type checker nor a glance at the
 *  markup catches it — the class is right there in the string — and on two of three themes the
 *  wrong value happened to be invisible. So the mechanism gets asserted, not the hex: whatever the
 *  token is set to, the border must equal it. */
test.describe("the strokes actually paint", () => {
  /** Resolve a CSS custom property to the rgb()/rgba() form getComputedStyle reports, so the
   *  assertion tracks whatever the token is set to rather than a hex the design may still be
   *  tuning. */
  const resolveToken = (page: Page, token: string) =>
    page.evaluate((name) => {
      const probe = document.createElement("div");
      probe.style.color = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      document.body.appendChild(probe);
      const value = getComputedStyle(probe).color;
      probe.remove();
      return value;
    }, token);

  test("a selected tile wears --tile-sel-border, not the transparent base", async ({ page }) => {
    await enterSelectMode(page, ["tokyo_JP", "paris_FR"], true);
    const tile = page.getByTestId("clock-tile-tokyo_JP");

    // toHaveCSS, not a one-shot read: the tile transitions border-color over 300ms, and mid-flight
    // Chrome reports the interpolated colour — which serialises as rgba(…, 1) rather than rgb(…),
    // so a single read races the transition and fails on a technicality. This polls until it settles.
    await expect(tile).toHaveCSS("border-top-color", await resolveToken(page, "--tile-sel-border"));
    // The class the bug killed must survive, and the one that killed it must not.
    const classes = await tile.evaluate((el) => [...el.classList]);
    expect(classes).toContain("border-[var(--tile-sel-border)]");
    expect(classes).not.toContain("border-transparent");
    // And exactly one stroke: no inset ring doubling it up.
    await expect(tile).toHaveCSS("box-shadow", "none");
  });

  test("the commit bar wears --share-bar-border, not the global --border", async ({ page }) => {
    await enterSelectMode(page, ["tokyo_JP", "paris_FR"], true);

    await expect(bar(page)).toHaveCSS("border-top-color", await resolveToken(page, "--share-bar-border"));
    // The old fallback: `* { @apply border-border }` painting a hard olive ring on Happy's white bar.
    await expect(bar(page)).not.toHaveCSS("border-top-color", await resolveToken(page, "--border"));
  });
});

test.describe("Copy Link", () => {
  test.use({ permissions: ["clipboard-read", "clipboard-write"] });

  test("copies the link, confirms inline on the button, and keeps the bar up", async ({ page }) => {
    await enterSelectMode(page, ["tokyo_JP", "paris_FR"], true);
    // Include Paris too, so the link carries more than the tile that launched the flow.
    await page.getByTestId("button-select-paris_FR").click();
    await expect(page.getByTestId("button-share-commit")).toHaveText("Share 2");

    await page.getByTestId("button-share-copy").click();

    // %2C, not a literal comma: URLSearchParams encodes the separator. It round-trips (the
    // incoming parse decodes it), so this is what shipped links have actually looked like all
    // along — asserted as-is rather than as the prettier form the docs describe.
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toMatch(/\/\?z=tokyo_JP%2Cparis_FR$/);
    // The confirmation is on the button itself now — no toast — and the bar stays put so the
    // selection isn't torn down just for copying a link.
    await expect(page.getByTestId("button-share-copy")).toHaveText("Copied");
    await expect(bar(page)).toBeVisible();
    // No sheet was opened — this path is the clipboard, not a silent share.
    expect(await page.evaluate(() => (window as any).__shared)).toHaveLength(0);
    expect(await trackedEvents(page, "share_committed")).toEqual([{ count: 2, method: "copy" }]);
  });

  test("disables at zero selection", async ({ page }) => {
    await enterSelectMode(page, ["tokyo_JP", "paris_FR"], true);
    await page.getByTestId("button-select-tokyo_JP").click(); // deselect the seeded tile

    await expect(page.getByTestId("button-share-copy")).toBeDisabled();
    await expect(page.getByTestId("button-share-commit")).toBeDisabled();
  });
});
