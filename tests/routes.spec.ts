import { test, expect } from "@playwright/test";
import { blockExternal, siteFooter } from "./helpers";

/** Content routes (About / Privacy / Support), the 404 fallback, and the universal footer that
 *  ties them together. These shipped across several sessions with no automated coverage; the
 *  regressions they've actually had were structural (a header padding that drifted out of sync,
 *  a footer hint leaking onto pages that don't resolve geolocation), so that's what's asserted. */

test.beforeEach(async ({ page }) => {
  await blockExternal(page);
});

const CONTENT_ROUTES = [
  { path: "/about", heading: "It's always that time somewhere!" },
  { path: "/privacy", heading: "Privacy" },
  { path: "/support", heading: "Support" },
] as const;

test.describe("content routes", () => {
  for (const { path, heading } of CONTENT_ROUTES) {
    test(`${path} renders its heading and the footer`, async ({ page }) => {
      await page.goto(path);

      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
      await expect(siteFooter(page)).toBeVisible();
      await expect(siteFooter(page).getByText("Design Dept Partners LLC")).toBeVisible();
    });

    test(`${path} shows no geolocation hint`, async ({ page }) => {
      // The hint is home-only: these pages never resolve geolocation, so a hint here would be
      // asking the user to fix something this page doesn't even use.
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
      await expect(page.getByTestId("text-geo-denied-hint")).toHaveCount(0);
    });
  }

  test("an unknown route renders the 404 page", async ({ page }) => {
    await page.goto("/no-such-page");

    await expect(page.getByText("404")).toBeVisible();
    await expect(page.getByText("Sorry, couldn’t find your page.")).toBeVisible();
  });
});

test.describe("footer navigation", () => {
  test("footer links navigate between content pages without a reload", async ({ page }) => {
    await page.goto("/about");

    // Marking the window proves wouter handled these client-side: a full document load would
    // wipe the property.
    await page.evaluate(() => ((window as unknown as { __spa?: boolean }).__spa = true));

    const footer = siteFooter(page);
    await footer.getByRole("link", { name: "Privacy" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Privacy" })).toBeVisible();

    await footer.getByRole("link", { name: "Support" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Support" })).toBeVisible();

    expect(await page.evaluate(() => (window as unknown as { __spa?: boolean }).__spa)).toBe(true);
    await expect(page).toHaveURL(/\/support$/);
  });

  test("the footer's About link returns to the home page", async ({ page }) => {
    await page.goto("/privacy");
    await siteFooter(page).getByRole("link", { name: "About" }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: "It's always that time somewhere!" })
    ).toBeVisible();
  });
});

test.describe("support: location instructions", () => {
  // These exist because a *user* can't fix a hard-blocked permission from inside the app — the
  // instructions are the whole feature, so a broken link is a broken feature.
  const HELP_LINKS = [
    {
      name: "Safari",
      href: "https://support.apple.com/guide/personal-safety/manage-location-services-settings-ips9bf20ad2f/web",
    },
    { name: "Chrome", href: "https://support.google.com/chrome/answer/142065" },
    {
      name: "Firefox",
      href: "https://support.mozilla.org/en-US/kb/does-firefox-share-my-location-websites",
    },
  ];

  test("the Location access section is present", async ({ page }) => {
    await page.goto("/support");
    await expect(page.getByRole("heading", { level: 2, name: "Location access" })).toBeVisible();
  });

  for (const { name, href } of HELP_LINKS) {
    test(`${name} links to its canonical help page, opened safely`, async ({ page }) => {
      await page.goto("/support");
      const link = page.getByRole("link", { name, exact: true });

      await expect(link).toHaveAttribute("href", href);
      await expect(link).toHaveAttribute("target", "_blank");
      // rel is what stops the opened tab from reaching back through window.opener.
      await expect(link).toHaveAttribute("rel", "noopener noreferrer");
    });
  }

  test("each browser's instructions lead with the iPhone path", async ({ page }) => {
    // The correctness point from the 2026-07-15 review: on iPhone, Chrome and Firefox inherit the
    // OS location permission rather than exposing a per-site toggle, so desktop-first steps are
    // wrong for the majority case. If someone rewrites this copy, this should fail loudly.
    await page.goto("/support");
    const section = page.locator("section", { has: page.getByRole("heading", { name: "Location access" }) });

    await expect(section.getByText(/Safari.*On iPhone: Settings → Privacy & Security/s)).toBeVisible();
    await expect(section.getByText(/Chrome.*On iPhone: open the Settings → Apps → Chrome/s)).toBeVisible();
    await expect(section.getByText(/Firefox.*On iPhone: open the Settings → Apps → Firefox/s)).toBeVisible();
  });
});
