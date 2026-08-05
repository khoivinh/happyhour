import { test, expect, type Page } from "@playwright/test";
import { blockExternal, seedZones } from "./helpers";

/** The message that rides along with a shared link (client/src/lib/share-text.ts), asserted through
 *  the real share paths rather than as a pure function — the module depends on the runtime-loaded
 *  city lookup, so exercising it in the browser is what proves the wiring, not just the formatting.
 *
 *  The clock is pinned to a fixed instant so the times are exact rather than shape-matched. August
 *  puts the northern zones in DST, which is what makes the expected labels CEST and EDT. */

const INSTANT = new Date("2026-08-01T12:00:00Z");

/** At INSTANT: Tokyo +9 → 21:00, Paris +2 (CEST) → 14:00, New York −4 (EDT) → 08:00.
 *  Each city reads time → AM/PM → zone → city, with the zone present only because "Time Zone
 *  Names" ships default-ON. */
const LIVE_TEXT =
  "Current time — 9:00 PM JST Tokyo/2:00 PM CEST Paris/8:00 AM EDT New York City";

/** The same board with "Time Zone Names" off — identical but for the dropped zones. */
const LIVE_TEXT_NO_ZONES =
  "Current time — 9:00 PM Tokyo/2:00 PM Paris/8:00 AM New York City";

const bar = (page: Page) => page.getByTestId("share-selection-bar");

/** Turn "Time Zone Names" off before boot. The preference is written with String(bool), and the
 *  default-ON init only applies when the key is absent, so an explicit "false" opts out. */
const zoneNamesOff = `localStorage.setItem('world-happyhour-zone-abbr', 'false');`;

function pinShareSheet() {
  return `
    window.__shared = [];
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: (data) => { window.__shared.push(data); return Promise.resolve(); },
    });
  `;
}

/** Seed deliberately out of east-to-west order, so a share that came out sorted can only have been
 *  sorted — not accidentally correct because it inherited the seed order. */
const SEED = ["paris_FR", "tokyo_JP", "newYorkCity_US"];

async function shareAllThree(page: Page, prefs?: string) {
  await blockExternal(page);
  // setFixedTime, not install+pauseAt: this only needs Date.now() pinned so the share text is
  // exact. pauseAt can't be used here — the fake clock ticks during page load, so the target
  // instant is already in its past by the time the page is ready.
  await page.clock.setFixedTime(INSTANT);
  await page.addInitScript(seedZones(SEED));
  if (prefs) await page.addInitScript(prefs);
  await page.addInitScript(pinShareSheet());
  await page.goto("/");
  await page.locator("#stcm-banner").getByRole("button", { name: "Accept all" }).click();
  await expect(page.locator("#stcm-banner")).toBeHidden();

  await page.getByTestId("button-tile-menu-paris_FR").click();
  await page.getByTestId("menu-share-paris_FR").click();
  await expect(bar(page)).toBeVisible();
  // Paris is seeded into select-mode; add the other two so all three travel.
  await page.getByTestId("clock-tile-tokyo_JP").click();
  await page.getByTestId("clock-tile-newYorkCity_US").click();
}

test.describe("the live share message", () => {
  test.use({ permissions: ["clipboard-read", "clipboard-write"] });

  test("names every city with its time and zone, east to west", async ({ page }) => {
    await shareAllThree(page);
    await page.getByTestId("button-share-commit").click();

    const shared = await page.evaluate(() => (window as any).__shared);
    expect(shared).toHaveLength(1);
    expect(shared[0].text).toBe(LIVE_TEXT);
    // text and url stay separate fields for the sheet, so targets can unfurl the link themselves.
    expect(shared[0].url).toMatch(/\/\?z=tokyo_JP%2Cparis_FR%2CnewYorkCity_US$/);
  });

  test("Copy Link puts the message and the link on the clipboard", async ({ page }) => {
    await shareAllThree(page);
    await page.getByTestId("button-share-copy").click();

    const copied = await page.evaluate(() => navigator.clipboard.readText());
    const [text, url, ...rest] = copied.split("\n");
    expect(text).toBe(LIVE_TEXT);
    // The URL lands last and alone, where a chat client will still detect and unfurl it.
    expect(url).toMatch(/\/\?z=tokyo_JP%2Cparis_FR%2CnewYorkCity_US$/);
    expect(rest).toEqual([]);
  });

  test("the ?z= payload carries the same east-to-west order the text does", async ({ page }) => {
    await shareAllThree(page);
    await page.getByTestId("button-share-copy").click();

    // Seeded Paris(+2), Tokyo(+9), New York(−4) — emitted easternmost first, so the recipient's
    // tiles and the OG preview inherit the ordering too.
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toContain("z=tokyo_JP%2Cparis_FR%2CnewYorkCity_US");
  });

  test("drops the zones when Time Zone Names is off", async ({ page }) => {
    await shareAllThree(page, zoneNamesOff);
    await page.getByTestId("button-share-copy").click();

    const [text] = (await page.evaluate(() => navigator.clipboard.readText())).split("\n");
    // The share follows the same preference the tiles do — one setting, not a share-only rule.
    expect(text).toBe(LIVE_TEXT_NO_ZONES);
  });
});

test.describe("the Happyhour link checkbox", () => {
  test.use({ permissions: ["clipboard-read", "clipboard-write"] });

  test("defaults on, and unchecking strips the link from the clipboard", async ({ page }) => {
    await shareAllThree(page);
    const checkbox = page.getByTestId("checkbox-include-local");
    await expect(checkbox).toHaveText(/Include Happyhour link/);
    await expect(checkbox).toHaveAttribute("aria-pressed", "true");

    await page.getByTestId("button-share-copy").click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("?z=");

    await checkbox.click();
    await expect(checkbox).toHaveAttribute("aria-pressed", "false");
    await page.getByTestId("button-share-copy").click();

    // Times only — no URL, and no trailing blank line where one used to be.
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toBe(LIVE_TEXT);
  });

  test("unchecking omits the url field from the share sheet entirely", async ({ page }) => {
    await shareAllThree(page);
    await page.getByTestId("checkbox-include-local").click();
    await page.getByTestId("button-share-commit").click();

    const shared = await page.evaluate(() => (window as any).__shared);
    expect(shared).toHaveLength(1);
    expect(shared[0].text).toBe(LIVE_TEXT);
    // Absent, not empty: `url: null` isn't valid ShareData and an empty string can render as a
    // stray link in some targets.
    expect(shared[0]).not.toHaveProperty("url");
  });
});

test.describe("the custom-time share message", () => {
  test.use({ permissions: ["clipboard-read", "clipboard-write"] });

  test("states the converted times without naming the zones", async ({ page }) => {
    await blockExternal(page);
    await page.clock.setFixedTime(INSTANT);
    await page.addInitScript(seedZones(SEED));
    await page.goto("/");
    await page.locator("#stcm-banner").getByRole("button", { name: "Accept all" }).click();
    await expect(page.locator("#stcm-banner")).toBeHidden();

    // Commit a custom time on the hero, which puts the whole board into conversion mode.
    await page.getByTestId("text-hero-time").click();
    await page.getByTestId("input-edit-time").fill("09:00");
    await page.getByTestId("input-edit-time").press("Enter");
    await expect(page.getByTestId("button-reset-time")).toBeVisible();

    await page.getByTestId("button-tile-menu-paris_FR").click();
    await page.getByTestId("menu-share-paris_FR").click();
    await page.getByTestId("clock-tile-tokyo_JP").click();
    await page.getByTestId("clock-tile-newYorkCity_US").click();
    await page.getByTestId("button-share-copy").click();

    const [text] = (await page.evaluate(() => navigator.clipboard.readText())).split("\n");

    // A conversion, not a snapshot: no "Current time" framing…
    expect(text).not.toContain("Current time");
    // …and no zone identification, because a fixed instant doesn't go stale the way a live one
    // does. This holds even though Time Zone Names is on — the setting governs live shares only.
    expect(text).not.toContain("GMT");
    expect(text).not.toContain("JST");
    // Still every city, still east-to-west, still one clock face each — now time-first.
    expect(text).toMatch(
      /^\d{1,2}:\d{2} [AP]M Tokyo\/\d{1,2}:\d{2} [AP]M Paris\/\d{1,2}:\d{2} [AP]M New York City$/
    );
  });
});

test.describe("the hero clock's Share Local Time", () => {
  test.use({ permissions: ["clipboard-read", "clipboard-write"] });

  /** The hero's own check. Grid tiles share the `select-check-` prefix, and the hero's key is
   *  geolocation-derived so it can't be named literally — scope to the hero section instead. */
  const heroCheck = (page: Page) =>
    page.locator('.hero-sticky [data-testid^="select-check-"]');

  async function openHeroShare(page: Page) {
    await blockExternal(page);
    await page.clock.setFixedTime(INSTANT);
    await page.addInitScript(seedZones(SEED));
    // Without a share sheet the bar drops the Share button, and with it the selection count.
    await page.addInitScript(pinShareSheet());
    await page.goto("/");
    await page.locator("#stcm-banner").getByRole("button", { name: "Accept all" }).click();
    await expect(page.locator("#stcm-banner")).toBeHidden();

    await page.getByTestId("button-hero-menu").click();
    await page.getByTestId("menu-share-local-time").click();
    await expect(bar(page)).toBeVisible();
  }

  test("opens the share with the local city checked and nothing else", async ({ page }) => {
    await openHeroShare(page);
    // Seeded from the hero alone — no grid tile was touched, so the bar counts exactly one.
    await expect(page.getByTestId("button-share-commit")).toHaveText("Share 1");
  });

  test("the ellipsis becomes a check that toggles the city back out", async ({ page }) => {
    await openHeroShare(page);
    // The ⋯ is gone while the bar is up; the check stands in its place.
    await expect(page.getByTestId("button-hero-menu")).toHaveCount(0);
    const check = heroCheck(page);
    await expect(check).toHaveAttribute("aria-pressed", "true");

    await check.click();
    await expect(check).toHaveAttribute("aria-pressed", "false");
    // Nothing selected anywhere now, so there is nothing to share.
    await expect(page.getByTestId("button-share-commit")).toBeDisabled();
  });

  test("swapping the ellipsis for the check doesn't move the hero's numbers", async ({ page }) => {
    await blockExternal(page);
    await page.clock.setFixedTime(INSTANT);
    await page.addInitScript(seedZones(SEED));
    await page.goto("/");
    await page.locator("#stcm-banner").getByRole("button", { name: "Accept all" }).click();
    await expect(page.locator("#stcm-banner")).toBeHidden();

    const before = await page.getByTestId("text-hero-time").boundingBox();
    await page.getByTestId("button-hero-menu").click();
    await page.getByTestId("menu-share-local-time").click();
    await expect(bar(page)).toBeVisible();
    const after = await page.getByTestId("text-hero-time").boundingBox();

    // Both controls sit in the same py-[11px] px-[5px] box, so the row can't reflow.
    expect(after!.y).toBeCloseTo(before!.y, 0);
    expect(after!.x).toBeCloseTo(before!.x, 0);
  });

  test("leaves the time editor reachable — the check is a separate target", async ({ page }) => {
    await openHeroShare(page);
    await page.getByTestId("text-hero-time").click();
    // Unlike a grid tile, the hero doesn't go inert in select mode: its check is its own button,
    // so the numbers keep their own job. time-picker.spec.ts owns the Escape half of this.
    await expect(page.getByTestId("input-edit-time")).toBeVisible();
  });
});

test.describe("the ghost button", () => {
  test("reads Done — leaving select-mode undoes nothing", async ({ page }) => {
    await shareAllThree(page);
    await expect(page.getByTestId("button-share-cancel")).toHaveText("Done");
  });
});
