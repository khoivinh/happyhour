# Happyhour — Status

Last updated: 2026-07-17

**Status:** In progress · **Live:** <https://happyhour.day> · **Stack:** Vite + React 18 + TS + Tailwind, static (Cloudflare Pages, auto-deploys on push) · **Repo:** `khoivinh/happyhour`

World clock + timezone converter (fka Khlock). No backend; weather via Open-Meteo (no API key).

## Current state
- **2026-07-17 (round 3) — the Sharing View is now a place you keep, shipped + live.** It used to strip its URL on arrival and die on Cancel; now it persists. Refresh re-enters it; **Cancel** drops to a **Resting** state (flat live clocks, each with a ⋯ **"Save {city}"** menu) instead of tearing the view down; Save re-enters **Select Mode** with just that city checked; the **logo** is the way out (`<a href="/">`, full nav so Back restores the view); tiles tick live, and a frozen `&t=` share shows a **Reset Time** link. Plus: copy → "clocks" (kept "cities" in the search box); wordmark ink now tracks `--foreground` (matches the hero clock, not pure black); drawer icon theme-aware (fixes Happy gray + dark inversion in one move); Copy Link → inline "Copied" (no toast, bar stays); Share no longer dismisses the bar. 61 tests, both new guards mutation-tested. → `docs/2026-07-17-share-round3-devlog.md`
- **2026-07-17 — two recipient-side bugs fixed + deployed (`e492aac`).** (1) Silktide's cookie banner (z-index 99999) buried 67 of the commit bar's 86px, so **Add was unclickable for every share recipient**; the bar now steps up over it. (2) Share keys resolved against `cities-top.json` (500), so **29,981 of 30,481 (98.4%) silently failed** and the headline counted survivors; now falls back to the full set, keys verified identical across tiers. 56 tests. → `docs/2026-07-17-devlog.md`

Older entries: `STATUS-archive.md`.

## Next steps
- Judge live on happyhour.day: the Reset Time link's vertical gap above the tiles; whether resting tiles reading flat on Happy yellow want a subtle edge
- Older open design calls (still unresolved, now judgeable live): the locked gray check ("already added" vs disabled?); whether selected tiles need a fill tint; the "Room for one more" copy; dark's select stroke `#5c4f2a` → `#473d21` sign-off
- `share_link_opened` now re-fires on refresh (URL persists) — dedupe is a one-liner if wanted
- Share-link leftover: a key resolving in *neither* tier is still dropped silently while the headline counts survivors; and the full-set fallback costs a 2 MB fetch before paint (748ms → 1816ms — watch on a phone)
- Real-device QA: the Resting↔Select feel, the full-reload logo escape, mobile drag (dnd-kit); confirm `share_*` events land
- A11y: `SiteFooter` renders inside `<main>`, so the footer isn't a `contentinfo` landmark
- `isDropdownOpen` / `isBeingDragged` hardcode light-mode hexes with only a `dark:` variant, so Happy falls through to light — same family as the drawer token just fixed
- Cookie-modal redesign: its save button reads "Accept all" even when saving Analytics *off*; decide whether the Figma capture script (`mcp.figma.com/.../capture.js`) ships to prod
- Wire `npm test` into CI (no workflow exists); verify iOS home-screen icon + Android favicon on real devices

## Pointers
- Key files: `client/src/pages/world-clock.tsx`, `components/digital-clock.tsx`, `components/time-zone-converter.tsx`, `components/logo-bar.tsx`, `components/shared-link-view.tsx`, `components/commit-bar.tsx`, `components/share-selection-bar.tsx`
- Tests: `npm test` (Playwright, `tests/`). Runs against a **prod build** — `analytics.ts` no-ops unless `import.meta.env.PROD`, so a dev server can't exercise analytics or the consent gate. Analytics assertions read `window.dataLayer`. Builds with `VITE_CLERK_PUBLISHABLE_KEY=` empty on purpose: a local `.env` key would compile in and mount `<ClerkProvider>`, so CI would test a different `App.tsx` branch than your machine.
- Sharing View states: `SharedLinkView` holds a local `mode: 'select' | 'resting'`. Select = checks + Commit Bar (arrival + post-Save); Resting = ⋯ "Save {city}" menu, no bar. Cancel → Resting (view stays; `onDismiss` is analytics-only). The `?z=`/`?t=` params **persist** (no longer stripped on mount) so refresh re-enters; `handleAddShared` clears the URL once consumed. Logo escape is a full `<a href="/">` so Back reloads and re-parses — wouter ignores the query string, so an SPA popstate wouldn't re-fire the parse.
- Share flow: link schema `/?z=<keys>[&t=<epoch ms>]` (`URLSearchParams` encodes commas as `%2C`; round-trips). **Sending:** select mode + link build in `time-zone-converter.tsx`; menu + tile selection in `digital-clock.tsx`. `DigitalClock` ellipsis menu renders when `!isSelectMode && (onShare || onSave)` — the board passes `onShare`/`onRemove`, the Resting view passes only `onSave`.
- Strokes: judge a tile stroke against **its own fill**, never the page. Use `cn()` for the tile's class chain: `border-transparent` and a state's `border-[…]` have equal specificity, so plain interpolation lets source order win and Tailwind emits `border-transparent` last. `tests/share-selection.spec.ts` guards it.
- City tiers: keys are **generated at runtime** by collision resolution, not stored — but identical in both tiers (verified 500/500), because `cities-top.json` is a population-ordered *prefix* of `cities.json`. Never resolve a user-supplied key against the top 500 alone (it's 500 of 30,481).
- The bottom of the viewport is shared: `SiteFooter`, the `CommitBar`, **and Silktide's cookie banner** (`#stcm-banner`, z-index 99999, always up for a first-time visitor — which every share recipient is). The bar steps up over it via `useConsentBannerHeight`. Anything new pinned to the bottom must account for all three.
- Timed UI in tests: `page.clock.install()` does **not** freeze time — use `install()` + `pauseAt(Date.now() + 60_000)`. Settled-position assertions must poll (`toPass`/`expect.poll`); a single read lands mid-transition.
- Header geometry is one interlocked system: `TOGGLE_TOP` (world-clock.tsx) sets the drawer icon **and** the menu panel; `LogoBar`'s padding and `.hero-clock`'s padding-top share a baseline. Change one, re-measure all four.
- Design doc: `docs/PRD.md` · Devlogs: `docs/` (latest 2026-07-17 round 3) · Branch previews: `<branch>.khlock.pages.dev` (Pages project still named `khlock`, *not* a `happyhour.day` subdomain).
