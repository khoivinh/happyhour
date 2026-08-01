import { test, expect, type Page } from "@playwright/test";
import { blockExternal, seedZones } from "./helpers";

/** The message that rides along with a shared link (client/src/lib/share-text.ts), asserted through
 *  the real share paths rather than as a pure function — the module depends on the runtime-loaded
 *  city lookup, so exercising it in the browser is what proves the wiring, not just the formatting.
 *
 *  The clock is pinned to a fixed instant so the times are exact rather than shape-matched. August
 *  puts the northern zones in DST, which is what makes the expected labels CEST and EDT. */

const INSTANT = new Date("2026-08-01T12:00:00Z");

/** At INSTANT: Tokyo +9 → 21:00, Paris +2 (CEST) → 14:00, New York −4 (EDT) → 08:00. */
const LIVE_TEXT =
  "Current time in Tokyo 9:00 PM JST GMT+9/Paris 2:00 PM CEST GMT+2/New York City 8:00 AM EDT GMT-4";

const bar = (page: Page) => page.getByTestId("share-selection-bar");

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

async function shareAllThree(page: Page) {
  await blockExternal(page);
  // setFixedTime, not install+pauseAt: this only needs Date.now() pinned so the share text is
  // exact. pauseAt can't be used here — the fake clock ticks during page load, so the target
  // instant is already in its past by the time the page is ready.
  await page.clock.setFixedTime(INSTANT);
  await page.addInitScript(seedZones(SEED));
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

    // A conversion, not a snapshot: no "Current time in" framing…
    expect(text).not.toContain("Current time in");
    // …and no zone identification, because a fixed instant doesn't go stale the way a live one does.
    expect(text).not.toContain("GMT");
    expect(text).not.toContain("JST");
    // Still every city, still east-to-west, still one clock face each.
    expect(text).toMatch(
      /^Tokyo \d{1,2}:\d{2} [AP]M\/Paris \d{1,2}:\d{2} [AP]M\/New York City \d{1,2}:\d{2} [AP]M$/
    );
  });
});

test.describe("the ghost button", () => {
  test("reads Done — leaving select-mode undoes nothing", async ({ page }) => {
    await shareAllThree(page);
    await expect(page.getByTestId("button-share-cancel")).toHaveText("Done");
  });
});
