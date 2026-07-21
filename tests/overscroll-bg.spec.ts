import { test, expect } from "@playwright/test";
import { blockExternal } from "./helpers";

/** iOS Safari paints the overscroll and address-bar regions from the <html> (document) background.
 *  If the theme background lives only on <body>, an iOS repaint can expose the unstyled document
 *  (white) while the theme-color chrome stays themed — a jarring mismatch (2026-07-21). This guards
 *  that <html> carries a real, non-transparent background matching <body>, so the two can't diverge. */
test.describe("overscroll / document background", () => {
  test("<html> carries the themed background, matching <body>", async ({ page }) => {
    await blockExternal(page);
    await page.goto("/");

    const { html, body } = await page.evaluate(() => ({
      html: getComputedStyle(document.documentElement).backgroundColor,
      body: getComputedStyle(document.body).backgroundColor,
    }));

    // A missing background computes to transparent — the exact bug this guards against.
    expect(html).not.toBe("rgba(0, 0, 0, 0)");
    expect(html).not.toBe("transparent");
    expect(html).toBe(body);
  });
});
