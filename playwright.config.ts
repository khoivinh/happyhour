import { defineConfig, devices } from "@playwright/test";

/** Tests run against a *production* build served by `vite preview`, not the dev server.
 *  This is deliberate: `analytics.ts` gates every event on `import.meta.env.PROD`, so a dev
 *  server can't exercise the analytics path at all — and the cookie banner's whole job is
 *  gating analytics. Building costs ~3s and buys us the code that actually ships. */
const PORT = 4173;

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],

  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
    // Geolocation is denied by default so the home page lands in its `geoDenied` state
    // deterministically, rather than depending on the CI machine's location.
    permissions: [],
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],

  webServer: {
    // Build with an empty Clerk key on purpose. A key present in a developer's .env gets baked
    // into the bundle, which mounts <ClerkProvider> and pulls Clerk over the network at boot —
    // so the suite would depend on someone's local .env and on Clerk being reachable, and CI
    // (no .env) would silently exercise a *different* branch of App.tsx than the dev machine.
    // Empty forces the localStorage-only path the app already supports, identically everywhere.
    command: `VITE_CLERK_PUBLISHABLE_KEY= npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    // Never reuse locally: a stale `vite preview` left running would serve an old dist/ and
    // silently test code that isn't the code you just changed.
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
