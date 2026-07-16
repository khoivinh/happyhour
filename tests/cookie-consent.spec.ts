import { test, expect } from "@playwright/test";
import { blockExternal, latestConsentUpdate, siteFooter } from "./helpers";

/** The cookie banner's only real job is driving Google's consent mode: `analytics_storage` starts
 *  'denied' (declared inline in index.html) and Silktide flips it on opt-in. So these tests assert
 *  the *consent signal*, read back from `window.dataLayer`, rather than Silktide's internals —
 *  the vendor's DOM and storage keys are theirs to change, the gtag contract is ours. */

test.beforeEach(async ({ page }) => {
  await blockExternal(page);
});

const banner = "#stcm-banner";
const modal = "#stcm-modal";

test.describe("first visit", () => {
  test("the banner appears and consent has not been decided", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator(banner)).toBeVisible();
    // Nothing is granted until the user answers — a 'default' denied block is declared in
    // index.html, but no 'update' should have fired yet.
    expect(await latestConsentUpdate(page)).toBeNull();
  });

  test("the floating cookie icon stays hidden", async ({ page }) => {
    // Deliberately suppressed in favour of the footer's "Cookie Preferences" link (index.css).
    await page.goto("/");
    await expect(page.locator(banner)).toBeVisible();
    await expect(page.locator("#stcm-icon")).toBeHidden();
  });
});

test.describe("accepting", () => {
  test("Accept all grants analytics_storage and dismisses the banner", async ({ page }) => {
    await page.goto("/");
    await page.locator(banner).getByRole("button", { name: "Accept all" }).click();

    await expect(page.locator(banner)).toBeHidden();
    expect(await latestConsentUpdate(page)).toMatchObject({ analytics_storage: "granted" });
  });

  test("the choice survives a reload", async ({ page }) => {
    await page.goto("/");
    await page.locator(banner).getByRole("button", { name: "Accept all" }).click();
    await expect(page.locator(banner)).toBeHidden();

    await page.reload();

    // Re-prompting someone who already answered is the classic consent-banner bug.
    await expect(page.locator(banner)).toBeHidden();
    expect(await latestConsentUpdate(page)).toMatchObject({ analytics_storage: "granted" });
  });
});

test.describe("rejecting", () => {
  test("Essential Only leaves analytics_storage denied", async ({ page }) => {
    await page.goto("/");
    await page.locator(banner).getByRole("button", { name: "Essential Only" }).click();

    await expect(page.locator(banner)).toBeHidden();
    expect(await latestConsentUpdate(page)).toMatchObject({ analytics_storage: "denied" });
  });

  test("the rejection survives a reload", async ({ page }) => {
    await page.goto("/");
    await page.locator(banner).getByRole("button", { name: "Essential Only" }).click();
    await expect(page.locator(banner)).toBeHidden();

    await page.reload();

    await expect(page.locator(banner)).toBeHidden();
    expect(await latestConsentUpdate(page)).toMatchObject({ analytics_storage: "denied" });
  });
});

test.describe("preferences modal", () => {
  test("the banner's Preferences link opens it", async ({ page }) => {
    await page.goto("/");
    await page.locator(banner).getByRole("button", { name: /preferences/i }).click();

    await expect(page.locator(modal)).toBeVisible();
    await expect(page.locator(modal).getByText("Necessary", { exact: true })).toBeVisible();
    await expect(page.locator(modal).getByText("Analytics", { exact: true })).toBeVisible();
  });

  test("the footer's Cookie Preferences link opens it after a choice is made", async ({ page }) => {
    // This is the only way back to the modal once the banner is gone, since the floating icon is
    // hidden — if `openCookiePreferences()` breaks, consent becomes a one-way door.
    await page.goto("/");
    await page.locator(banner).getByRole("button", { name: "Accept all" }).click();
    await expect(page.locator(banner)).toBeHidden();

    await siteFooter(page).getByRole("button", { name: "Cookie Preferences" }).click();

    await expect(page.locator(modal)).toBeVisible();
  });

  test("Cookie Preferences works from a content page too", async ({ page }) => {
    await page.goto("/about");
    await page.locator(banner).getByRole("button", { name: "Accept all" }).click();
    await expect(page.locator(banner)).toBeHidden();

    await siteFooter(page).getByRole("button", { name: "Cookie Preferences" }).click();

    await expect(page.locator(modal)).toBeVisible();
  });

  test("turning analytics off in the modal revokes consent", async ({ page }) => {
    await page.goto("/");
    await page.locator(banner).getByRole("button", { name: "Accept all" }).click();
    await expect(page.locator(banner)).toBeHidden();
    expect(await latestConsentUpdate(page)).toMatchObject({ analytics_storage: "granted" });

    await siteFooter(page).getByRole("button", { name: "Cookie Preferences" }).click();
    await expect(page.locator(modal)).toBeVisible();

    // Click the toggle's label, not the input: the input is visually covered by the toggle track,
    // which is what a real pointer lands on. Analytics is the only non-required consent type
    // ('Necessary' is checked and disabled).
    await expect(page.locator("#consent-analytics")).toBeChecked();
    await page.locator(`${modal} label[for="consent-analytics"]`).click();
    await expect(page.locator("#consent-analytics")).not.toBeChecked();

    // The save button reads "Accept all" even when you've just switched Analytics off — see
    // `preferences.saveButtonText` in index.html. It does honour the toggle; the label is the lie.
    await page.locator(`${modal} .stcm-modal-save`).click();

    await expect(page.locator(modal)).toBeHidden();
    expect(await latestConsentUpdate(page)).toMatchObject({ analytics_storage: "denied" });
  });
});
