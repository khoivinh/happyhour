import type { Locator, Page } from "@playwright/test";

/** The app's own footer. Scoped to #root deliberately: Silktide injects a *second* `<footer>`
 *  (inside its hidden preferences modal), so a bare `footer` locator is ambiguous. `contentinfo`
 *  doesn't work either — SiteFooter renders inside `<main>`, and a `<footer>` scoped to `main`
 *  isn't exposed as a landmark. */
export function siteFooter(page: Page): Locator {
  return page.locator("#root footer");
}

/** Third-party hosts the app talks to in a real browser. Tests abort them so a run is
 *  hermetic and fast — no font FOUT waits, no live GA, no weather flake.
 *
 *  Blocking googletagmanager is safe for analytics assertions: `index.html` declares its own
 *  `function gtag(){dataLayer.push(arguments)}` inline, so `window.gtag` exists (and
 *  `analytics.ts`'s `shouldSend()` passes) whether or not Google's script ever loads. Events
 *  land in `window.dataLayer` either way, which is exactly what we read back. */
const EXTERNAL_HOSTS = [
  "**/*.googleapis.com/**",
  "**/*.gstatic.com/**",
  "**/*.googletagmanager.com/**",
  "**/mcp.figma.com/**",
  "**/*.open-meteo.com/**",
];

export async function blockExternal(page: Page): Promise<void> {
  for (const pattern of EXTERNAL_HOSTS) {
    await page.route(pattern, (route) => route.abort());
  }
}

type DataLayerEntry = unknown[];

/** Every `gtag(...)` call, in order, as plain arrays. `gtag` pushes its `arguments` object onto
 *  `window.dataLayer`, so this is the whole analytics surface without stubbing anything. */
export async function dataLayer(page: Page): Promise<DataLayerEntry[]> {
  return page.evaluate(() =>
    ((window as unknown as { dataLayer?: ArrayLike<unknown>[] }).dataLayer ?? []).map((entry) =>
      Array.from(entry)
    )
  );
}

/** The params of each `gtag('event', <name>, params)` call matching `name`. */
export async function trackedEvents(
  page: Page,
  name: string
): Promise<Record<string, unknown>[]> {
  const entries = await dataLayer(page);
  return entries
    .filter((e) => e[0] === "event" && e[1] === name)
    .map((e) => (e[2] ?? {}) as Record<string, unknown>);
}

/** The most recent `gtag('consent', 'update', {...})` payload, or null if consent was never
 *  updated (i.e. the user hasn't answered the banner). */
export async function latestConsentUpdate(
  page: Page
): Promise<Record<string, unknown> | null> {
  const entries = await dataLayer(page);
  const updates = entries.filter((e) => e[0] === "consent" && e[1] === "update");
  if (updates.length === 0) return null;
  return (updates[updates.length - 1][2] ?? {}) as Record<string, unknown>;
}

/** Seed the saved-zones key so a test starts from a known board instead of the empty default
 *  (new users now start with zero clocks). Also sets the onboarding flag, so the tagline never
 *  covers what we're asserting.
 *  Must run before the app boots — call it via `page.addInitScript`.
 *
 *  Only writes when the key is absent, which matters more than it looks: init scripts re-run on
 *  every navigation *and every reload*, so an unconditional write would re-assert the starting
 *  board each time and silently undo whatever the app had saved. A test that reloads to prove
 *  persistence would then be testing the seed, not the product. Seed a starting point once; let
 *  the app own the key from there. */
export function seedZones(zoneKeys: string[]) {
  return `
    if (localStorage.getItem('world-happyhour-zones') === null) {
      localStorage.setItem('world-happyhour-zones', ${JSON.stringify(JSON.stringify(zoneKeys))});
    }
    localStorage.setItem('world-happyhour-onboarded', '1');
  `;
}
