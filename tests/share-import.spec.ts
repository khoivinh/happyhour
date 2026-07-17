import { test, expect, type Page } from "@playwright/test";
import { blockExternal, seedZones, trackedEvents } from "./helpers";

/** Opening a shared `/?z=…` link lands on the Sharing View: the cities are shown running, in
 *  their real time, and the recipient chooses before committing. It replaced a modal dialog that
 *  asked "Add shared clocks?" before showing anything.
 *
 *  The cap is the load-bearing case. The dialog used to merge-then-truncate, so a recipient could
 *  accept "Tokyo, Paris, and 4 more" and silently not get them. Here nothing can be selected that
 *  wouldn't survive the merge, so Add is always literally true. */

// Real keys, derived from cities-top.json's own key algorithm (name + ISO2).
const FIFTEEN_ZONES = [
  "shanghai_CN", "beijing_CN", "shenzhen_CN", "guangzhou_CN", "kinshasa_CD",
  "istanbul_TR", "lagos_NG", "hoChiMinhCity_VN", "chengdu_CN", "lahore_PK",
  "mumbai_IN", "saoPaulo_BR", "mexicoCity_MX", "karachi_PK", "tianjin_CN",
];

const tiles = (page: Page) => page.locator('[data-testid^="draggable-zone-"]');
const sharedTiles = (page: Page) => page.locator('[data-testid^="shared-zone-"]');
const importBar = (page: Page) => page.getByTestId("share-import-bar");
const checkState = (page: Page, key: string) =>
  page.getByTestId(`select-check-${key}`).locator("span");

/** Answer the cookie banner on a plain load first, so it isn't sitting over the commit bar on
 *  the loads that matter. The choice persists for the context. */
async function dismissBanner(page: Page) {
  await page.goto("/");
  await page.locator("#stcm-banner").getByRole("button", { name: "Accept all" }).click();
  await expect(page.locator("#stcm-banner")).toBeHidden();
}

test.beforeEach(async ({ page }) => {
  await blockExternal(page);
  // Freeze the page clock. The arrival highlight retires itself on a 2s timer, and under CPU
  // contention the gap between clicking Add and asserting can exceed it — the highlight would be
  // correct and already gone, which reads as a real failure.
  //
  // pauseAt is the part that matters: `install()` alone does NOT stop time, it ticks along with
  // the wall clock (measured — a 2s timer still fires after 3s of real time, and the page's own
  // Date.now() advances). Only install + pauseAt actually freezes timers. Tests that rely on
  // install() alone aren't frozen, just fast, and will flake the moment the machine is busy.
  //
  // The collapse is a CSS transition rather than a JS timer, so it still runs and still fires
  // transitionend with the clock paused.
  await page.clock.install();
  // Aim ahead, not at "now": the fake clock keeps ticking between install() and pauseAt(), so
  // `Date.now()` read here is already the clock's past by the time it lands, and pauseAt rejects
  // that ("Cannot fast-forward to the past") — intermittently, under load. Jumping forward is free
  // here because the app hasn't loaded yet, so there are no timers for the jump to fire.
  await page.clock.pauseAt(Date.now() + 60_000);
});

test.describe("arriving on a shared link", () => {
  test("shows the shared cities instead of asking first", async ({ page }) => {
    await page.addInitScript(seedZones(["chicago_US"]));
    await dismissBanner(page);

    await page.goto("/?z=tokyo_JP,newYorkCity_US");
    await expect(page.getByTestId("text-share-headline")).toHaveText("Two clocks shared with you.");
    await expect(sharedTiles(page)).toHaveCount(2);
    await expect(importBar(page)).toContainText("Add these clocks to your Happyhour?");
    // The recipient's own board is not on this surface, and there is no dialog to dismiss.
    await expect(tiles(page)).toHaveCount(0);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    // The params now PERSIST: the Sharing View is a place the recipient can keep, so a refresh
    // re-enters it rather than dropping to the board.
    await expect(page).toHaveURL(/\?z=/);
  });

  test("counts in words, and in the singular at one", async ({ page }) => {
    await page.addInitScript(seedZones(["chicago_US"]));
    await dismissBanner(page);

    await page.goto("/?z=tokyo_JP");
    await expect(page.getByTestId("text-share-headline")).toHaveText("One clock shared with you.");
  });

  /** Keys are resolved against cities-top.json (500 cities) because it's already in the initial
   *  payload — but a sender can share any of the 30k in cities.json, and 98% of them live only
   *  there. Those silently failed to resolve and were filtered out, and the headline then counted
   *  the survivors: a three-city link arrived announcing "Two time zones shared with you."
   *  Heidelberg is the real case that surfaced it — big enough to share, far outside the top 500. */
  test("resolves cities outside the top-500 bundle", async ({ page }) => {
    await page.addInitScript(seedZones(["chicago_US"]));
    await dismissBanner(page);

    await page.goto("/?z=losAngeles_US,newYorkCity_US,heidelberg_DE");
    await expect(page.getByTestId("text-share-headline")).toHaveText(
      "Three clocks shared with you."
    );
    await expect(sharedTiles(page)).toHaveCount(3);
    await expect(page.getByTestId("shared-zone-heidelberg_DE")).toContainText("Heidelberg");
  });

  test("reports the offered count when the link is opened", async ({ page }) => {
    await page.addInitScript(seedZones(["chicago_US"]));
    await dismissBanner(page);

    await page.goto("/?z=tokyo_JP,newYorkCity_US");
    await expect(importBar(page)).toBeVisible();

    expect(await trackedEvents(page, "share_link_opened")).toEqual([{ count: 2 }]);
  });

  test("never flashes the recipient's own board on the way in", async ({ page }) => {
    // The keys resolve async (they need the city lookup), so the board used to mount and paint for
    // a frame before the Sharing View replaced it. Worse than a flicker: mounting the board
    // resolves geolocation, and a denied prompt left the footer's "allow location for more precise
    // local time" notice stranded on a surface that shows no local time. Observe from the very
    // first script — a MutationObserver attached at DOMContentLoaded misses it, because module
    // scripts run *before* that fires.
    await page.addInitScript(seedZones(["chicago_US", "denver_US"]));
    await page.addInitScript(() => {
      (window as any).__sawBoard = false;
      new MutationObserver(() => {
        if (document.querySelector('[data-testid^="draggable-zone-"]')) (window as any).__sawBoard = true;
      }).observe(document.documentElement, { childList: true, subtree: true });
    });
    await dismissBanner(page);

    await page.goto("/?z=tokyo_JP,paris_FR");
    await expect(importBar(page)).toBeVisible();

    expect(await page.evaluate(() => (window as any).__sawBoard)).toBe(false);
    await expect(page.getByTestId("text-geo-denied-hint")).toHaveCount(0);
  });

  test("has no drawer toggle — its settings would act on a board not yet accepted", async ({ page }) => {
    await page.addInitScript(seedZones(["chicago_US"]));
    await dismissBanner(page);

    await page.goto("/?z=tokyo_JP");
    await expect(importBar(page)).toBeVisible();
    await expect(page.getByTestId("button-drawer-toggle")).toBeHidden();
  });
});

test.describe("choosing which cities to take", () => {
  test("everything that fits starts checked", async ({ page }) => {
    await page.addInitScript(seedZones(["chicago_US"]));
    await dismissBanner(page);

    await page.goto("/?z=tokyo_JP,paris_FR,london_GB");
    await expect(importBar(page)).toContainText("Add 3");
    for (const key of ["tokyo_JP", "paris_FR", "london_GB"]) {
      await expect(checkState(page, key)).toHaveAttribute("data-state", "selected");
    }
  });

  test("unchecking a city drops it from the count and from the add", async ({ page }) => {
    await page.addInitScript(seedZones(["chicago_US"]));
    await dismissBanner(page);

    await page.goto("/?z=tokyo_JP,paris_FR,london_GB");
    await page.getByTestId("button-select-paris_FR").click();

    await expect(checkState(page, "paris_FR")).toHaveAttribute("data-state", "unselected");
    await expect(importBar(page)).toContainText("Add 2");

    await page.getByTestId("button-share-import-add").click();
    await expect(tiles(page)).toHaveCount(3); // chicago + tokyo + london
    await expect(page.getByTestId("draggable-zone-paris_FR")).toHaveCount(0);
  });

  test("a city already on the board is locked, not offered", async ({ page }) => {
    await page.addInitScript(seedZones(["tokyo_JP", "chicago_US"]));
    await dismissBanner(page);

    await page.goto("/?z=tokyo_JP,paris_FR");
    // Locked reads as settled fact, not as "unselected" — a filled check, just muted.
    await expect(checkState(page, "tokyo_JP")).toHaveAttribute("data-state", "locked");
    // Nothing to press: the tap layer isn't rendered at all.
    await expect(page.getByTestId("button-select-tokyo_JP")).toHaveCount(0);
    // Tokyo isn't part of the count — only Paris is actually being added.
    await expect(importBar(page)).toContainText("Add 1");
  });

  test("says so when there is nothing left to add", async ({ page }) => {
    await page.addInitScript(seedZones(["tokyo_JP", "paris_FR"]));
    await dismissBanner(page);

    await page.goto("/?z=tokyo_JP,paris_FR");
    await expect(importBar(page)).toContainText("You already have these clocks.");
    await expect(page.getByTestId("button-share-import-add")).toBeDisabled();
  });

  test("Add disables when everything is unchecked", async ({ page }) => {
    await page.addInitScript(seedZones(["chicago_US"]));
    await dismissBanner(page);

    await page.goto("/?z=tokyo_JP");
    await page.getByTestId("button-select-tokyo_JP").click();
    await expect(page.getByTestId("button-share-import-add")).toBeDisabled();
  });
});

test.describe("the 16-clock cap", () => {
  test("pre-checks only what fits, and says so", async ({ page }) => {
    await page.addInitScript(seedZones(FIFTEEN_ZONES));
    await dismissBanner(page);

    // 15 owned + 3 shared = 18, so only one of the shared cities can land.
    await page.goto("/?z=delhi_IN,wuhan_CN,moscow_RU");
    await expect(importBar(page)).toContainText("Room for one more — Happyhour holds 16.");
    await expect(importBar(page)).toContainText("Add 1");
    await expect(checkState(page, "delhi_IN")).toHaveAttribute("data-state", "selected");
    // Not merely "unselected": the ones that can't currently be taken say so, rather than looking
    // pressable and ignoring the press.
    await expect(checkState(page, "wuhan_CN")).toHaveAttribute("data-state", "blocked");
    await expect(checkState(page, "moscow_RU")).toHaveAttribute("data-state", "blocked");
    await expect(page.getByTestId("button-select-wuhan_CN")).toHaveAttribute("aria-disabled", "true");
  });

  test("refuses to check more than fits", async ({ page }) => {
    await page.addInitScript(seedZones(FIFTEEN_ZONES));
    await dismissBanner(page);

    await page.goto("/?z=delhi_IN,wuhan_CN,moscow_RU");
    // force: true on purpose. Playwright's normal click waits for "enabled", and aria-disabled
    // makes it give up — which is itself the affordance working. But the guard shouldn't live only
    // in the markup, so this drives the click through anyway and checks the handler also refuses.
    await page.getByTestId("button-select-wuhan_CN").click({ force: true });

    // At the cap: the click does nothing rather than silently bumping Delhi out.
    await expect(checkState(page, "wuhan_CN")).toHaveAttribute("data-state", "blocked");
    await expect(importBar(page)).toContainText("Add 1");
  });

  test("frees a slot when you uncheck, so you can swap", async ({ page }) => {
    await page.addInitScript(seedZones(FIFTEEN_ZONES));
    await dismissBanner(page);

    await page.goto("/?z=delhi_IN,wuhan_CN,moscow_RU");
    await page.getByTestId("button-select-delhi_IN").click(); // free the one slot
    // Freeing a slot must un-block the others — blocked is a live state, not a disabled one.
    await expect(checkState(page, "wuhan_CN")).toHaveAttribute("data-state", "unselected");
    await page.getByTestId("button-select-wuhan_CN").click(); // now it fits

    await expect(checkState(page, "delhi_IN")).toHaveAttribute("data-state", "blocked");
    await expect(checkState(page, "wuhan_CN")).toHaveAttribute("data-state", "selected");
    await expect(importBar(page)).toContainText("Add 1");

    await page.getByTestId("button-share-import-add").click();
    await expect(tiles(page)).toHaveCount(16);
    await expect(page.getByTestId("draggable-zone-wuhan_CN")).toBeVisible();
    await expect(page.getByTestId("draggable-zone-delhi_IN")).toHaveCount(0);
  });

  test("never adds more than the board holds", async ({ page }) => {
    await page.addInitScript(seedZones(FIFTEEN_ZONES));
    await dismissBanner(page);

    await page.goto("/?z=delhi_IN,wuhan_CN,moscow_RU");
    await page.getByTestId("button-share-import-add").click();

    await expect(tiles(page)).toHaveCount(16);
    // `count` is what the link offered; `added` is what landed; `capped` says the limit is why.
    expect(await trackedEvents(page, "share_link_added")).toEqual([
      { count: 3, added: 1, capped: true },
    ]);
  });

  test("reports capped:false when the limit was not what stopped them", async ({ page }) => {
    await page.addInitScript(seedZones(["chicago_US"]));
    await dismissBanner(page);

    await page.goto("/?z=tokyo_JP,paris_FR");
    await page.getByTestId("button-select-paris_FR").click(); // declined, not blocked
    await page.getByTestId("button-share-import-add").click();
    await expect(tiles(page)).toHaveCount(2);

    expect(await trackedEvents(page, "share_link_added")).toEqual([
      { count: 2, added: 1, capped: false },
    ]);
  });

  test("says the clocks are full when nothing can fit at all", async ({ page }) => {
    await page.addInitScript(seedZones([...FIFTEEN_ZONES, "delhi_IN"]));
    await dismissBanner(page);

    await page.goto("/?z=wuhan_CN,moscow_RU");
    await expect(importBar(page)).toContainText("Your clocks are full — Happyhour holds 16.");
    await expect(page.getByTestId("button-share-import-add")).toBeDisabled();
  });
});

test.describe("committing", () => {
  test("hands over the board with the new cities flagged", async ({ page }) => {
    await page.addInitScript(seedZones(["chicago_US"]));
    await dismissBanner(page);

    await page.goto("/?z=tokyo_JP,paris_FR");
    await page.getByTestId("button-share-import-add").click();

    // The Sharing View retires and the real board arrives — hero, drawer and all.
    await expect(importBar(page)).toHaveCount(0);
    await expect(page.getByTestId("text-share-headline")).toHaveCount(0);
    await expect(page.getByTestId("button-drawer-toggle")).toBeVisible();
    await expect(page.getByTestId("button-add-timezone")).toBeVisible();

    await expect(tiles(page)).toHaveCount(3);
    // Added cities flash; the one they already had doesn't.
    await expect(page.getByTestId("clock-tile-tokyo_JP")).toHaveClass(/animate-highlight-yellow/);
    await expect(page.getByTestId("clock-tile-paris_FR")).toHaveClass(/animate-highlight-yellow/);
    await expect(page.getByTestId("clock-tile-chicago_US")).not.toHaveClass(/animate-highlight-yellow/);
  });

  test("persists the merged board", async ({ page }) => {
    await page.addInitScript(seedZones(["chicago_US"]));
    await dismissBanner(page);

    await page.goto("/?z=tokyo_JP,paris_FR");
    await page.getByTestId("button-share-import-add").click();
    await expect(tiles(page)).toHaveCount(3);

    const stored = await page.evaluate(() => localStorage.getItem("world-happyhour-zones"));
    expect(JSON.parse(stored!)).toEqual(["chicago_US", "tokyo_JP", "paris_FR"]);

    // And it survives a reload without re-prompting.
    await page.reload();
    await expect(tiles(page)).toHaveCount(3);
    await expect(importBar(page)).toHaveCount(0);
  });

  test("Cancel drops to the resting view — it does not take the board or leave", async ({ page }) => {
    await page.addInitScript(seedZones(["chicago_US"]));
    await dismissBanner(page);

    await page.goto("/?z=tokyo_JP,paris_FR");
    await page.getByTestId("button-share-import-cancel").click();

    // The bar is gone, but the Sharing View is NOT: the shared clocks stay on screen (that's the
    // whole point of the round), the recipient's own board never appears, and the URL is untouched.
    await expect(importBar(page)).toHaveCount(0);
    await expect(sharedTiles(page)).toHaveCount(2);
    await expect(tiles(page)).toHaveCount(0);
    await expect(page).toHaveURL(/\?z=/);
    // Resting: every tile now carries the ellipsis "Save" menu instead of a checkbox.
    await expect(page.getByTestId("button-tile-menu-tokyo_JP")).toBeVisible();
    expect(await trackedEvents(page, "share_link_dismissed")).toEqual([{ count: 2 }]);
    expect(await trackedEvents(page, "share_link_added")).toEqual([]);
  });

  test("confirming does not also report a dismissal", async ({ page }) => {
    await page.addInitScript(seedZones(["chicago_US"]));
    await dismissBanner(page);

    await page.goto("/?z=tokyo_JP,paris_FR");
    await page.getByTestId("button-share-import-add").click();
    await expect(tiles(page)).toHaveCount(3);

    expect(await trackedEvents(page, "share_link_dismissed")).toEqual([]);
  });
});

test.describe("a frozen share (&t=)", () => {
  // A fixed instant so the assertion doesn't depend on when the suite runs.
  const FROZEN = Date.UTC(2026, 6, 15, 19, 0, 0); // 2026-07-15 19:00 UTC

  test("shows the shared moment, not the current one, and keeps it after adding", async ({ page }) => {
    await page.addInitScript(seedZones(["chicago_US"]));
    await dismissBanner(page);

    await page.goto(`/?z=tokyo_JP&t=${FROZEN}`);
    // Tokyo is GMT+9, so 19:00 UTC is 04:00 the next day — regardless of the runner's clock.
    await expect(page.getByTestId("shared-zone-tokyo_JP")).toContainText("4:00");

    await page.getByTestId("button-share-import-add").click();
    await expect(tiles(page)).toHaveCount(2);
    // The board lands in custom mode holding the same instant, so Reset is offered.
    await expect(page.getByTestId("clock-tile-tokyo_JP")).toContainText("4:00");
  });

  test("offers Reset Time, which drops the frozen instant", async ({ page }) => {
    await page.addInitScript(seedZones(["chicago_US"]));
    await dismissBanner(page);

    await page.goto(`/?z=tokyo_JP&t=${FROZEN}`);
    await expect(page.getByTestId("shared-zone-tokyo_JP")).toContainText("4:00");
    await expect(page.getByTestId("button-share-reset-time")).toBeVisible();

    await page.getByTestId("button-share-reset-time").click();
    // The link only shows while a shared instant is frozen, so resetting to live removes it.
    await expect(page.getByTestId("button-share-reset-time")).toHaveCount(0);
  });

  test("a live share has no Reset Time link", async ({ page }) => {
    await page.addInitScript(seedZones(["chicago_US"]));
    await dismissBanner(page);

    await page.goto("/?z=tokyo_JP");
    await expect(importBar(page)).toBeVisible();
    await expect(page.getByTestId("button-share-reset-time")).toHaveCount(0);
  });
});

/** The round's headline change: the Sharing View is a place the recipient keeps, not a prompt they
 *  answer once. It survives refresh, Cancel drops it to a resting browse state rather than tearing it
 *  down, the logo is the way out (with Back restoring it), and a resting tile's Save re-enters the
 *  pick flow. */
test.describe("the persistent Sharing View", () => {
  test("a refresh re-enters the view instead of dropping to the board", async ({ page }) => {
    await page.addInitScript(seedZones(["chicago_US"]));
    await dismissBanner(page);

    await page.goto("/?z=tokyo_JP,paris_FR");
    await expect(importBar(page)).toBeVisible();

    await page.reload();
    await expect(page.getByTestId("text-share-headline")).toBeVisible();
    await expect(sharedTiles(page)).toHaveCount(2);
    await expect(tiles(page)).toHaveCount(0);
  });

  test("the logo links back to the board, and Back restores the view", async ({ page }) => {
    await page.addInitScript(seedZones(["chicago_US"]));
    await dismissBanner(page);

    await page.goto("/?z=tokyo_JP,paris_FR");
    // Only here is the logo a link; on the board it's a plain heading.
    const logoLink = page.locator('header a[href="/"]');
    await expect(logoLink).toBeVisible();
    await logoLink.click();

    // A full navigation to the recipient's own board — the Sharing View is gone.
    await expect(tiles(page)).toHaveCount(1);
    await expect(page.getByTestId("text-share-headline")).toHaveCount(0);

    // Back reloads the shared URL and re-enters the view with its clocks intact.
    await page.goBack();
    await expect(sharedTiles(page)).toHaveCount(2);
    await expect(page.getByTestId("text-share-headline")).toBeVisible();
  });

  test("Save on a resting tile re-enters Select Mode with just that city checked", async ({ page }) => {
    await page.addInitScript(seedZones(["chicago_US"]));
    await dismissBanner(page);

    await page.goto("/?z=tokyo_JP,paris_FR,london_GB");
    // Drop to resting: the bar goes, the ellipsis menus appear.
    await page.getByTestId("button-share-import-cancel").click();
    await expect(importBar(page)).toHaveCount(0);

    await page.getByTestId("button-tile-menu-paris_FR").click();
    await page.getByTestId("menu-save-paris_FR").click();

    // Back in Select Mode: the bar returns, and ONLY the saved city is pre-checked (not the whole
    // set, the way arrival pre-checks) — the others reset to unselected.
    await expect(importBar(page)).toBeVisible();
    await expect(importBar(page)).toContainText("Add 1");
    await expect(checkState(page, "paris_FR")).toHaveAttribute("data-state", "selected");
    await expect(checkState(page, "tokyo_JP")).toHaveAttribute("data-state", "unselected");
    await expect(checkState(page, "london_GB")).toHaveAttribute("data-state", "unselected");
  });
});

/** Every other test in this file calls dismissBanner() first, which is exactly why this bug shipped:
 *  the suite systematically removed the only condition that triggers it. A recipient opening a
 *  shared link is a first-time visitor by definition — the cookie banner is *always* up for them,
 *  so this is the one state the share flow can least afford to get wrong.
 *
 *  Silktide pins its banner to the bottom at z-index 99999. The bar can't out-stack that, and
 *  shouldn't: burying a consent prompt is the one thing that surface must never do. So the bar
 *  yields, and these tests hold it to that. No dismissBanner() here, deliberately. */
test.describe("the cookie banner and the commit bar", () => {
  /** Polls rather than reading once. The banner is injected late, the bar reacts to it, and the
   *  step-up is a 200ms transition — so there's a window where the bar is legitimately still on its
   *  way. A single read lands mid-flight and reports the un-lifted position, which looks exactly
   *  like the bug. The claim being tested is about where the bar comes to rest. */
  test("the bar sits clear of the banner instead of under it", async ({ page }) => {
    await page.addInitScript(seedZones(["chicago_US"]));
    await page.goto("/?z=tokyo_JP,newYorkCity_US");

    await expect(page.locator("#stcm-banner")).toBeVisible();
    await expect(importBar(page)).toBeVisible();

    await expect(async () => {
      const bannerBox = (await page.locator("#stcm-banner").boundingBox())!;
      const barBox = (await importBar(page).boundingBox())!;
      expect(barBox.y + barBox.height).toBeLessThanOrEqual(bannerBox.y);
    }).toPass({ timeout: 5000 });
  });

  /** The assertion that actually matters: geometry can look right while something invisible still
   *  eats the click. Playwright refuses to click an element another element would intercept, so
   *  this fails on the shipped bug — where the banner covered 67 of the bar's 86px. */
  test("Add is clickable while the banner is up", async ({ page }) => {
    await page.addInitScript(seedZones(["chicago_US"]));
    await page.goto("/?z=tokyo_JP,newYorkCity_US");

    await expect(page.locator("#stcm-banner")).toBeVisible();
    await page.getByTestId("button-share-import-add").click({ timeout: 5000 });
    await expect(tiles(page)).toHaveCount(3);
  });

  /** The lift has to be temporary, or answering the banner would leave a permanent 67px hole.
   *  Asserted against the viewport rather than against an earlier reading of the bar: a "before"
   *  captured mid-transition isn't a fact to compare against. */
  test("the bar drops back down once the banner is answered", async ({ page }) => {
    await page.addInitScript(seedZones(["chicago_US"]));
    await page.goto("/?z=tokyo_JP,newYorkCity_US");
    await expect(page.locator("#stcm-banner")).toBeVisible();

    await page.locator("#stcm-banner").getByRole("button", { name: "Accept all" }).click();
    await expect(page.locator("#stcm-banner")).toBeHidden();

    // Back to resting: the bar's own 16px bottom padding is all that's below it.
    const viewport = page.viewportSize()!.height;
    await expect
      .poll(async () => Math.round((await importBar(page).boundingBox())!.y + (await importBar(page).boundingBox())!.height), { timeout: 5000 })
      .toBeGreaterThan(viewport - 24);
  });
});
