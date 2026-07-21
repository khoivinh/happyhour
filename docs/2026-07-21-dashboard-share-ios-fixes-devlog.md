# 2026-07-21 — Dashboard & Sharing-View iOS 26 fixes

From `Obsidian/Scratch/2026-07-21-happyhour-edit-1648.md` + two iPhone screenshots (IMG_0068/0069).
Three iOS-26 rendering bugs; two high-confidence, one device-QA.

## Bug 2 — overscroll/address-bar color mismatch after a settings change (HIGH)
IMG_0069 (after toggling 24-hour, happy theme) showed **white content but a yellow status-bar strip
and yellow address-bar region**. Cause: `bg-background` was on `<body>` only; `<html>` had no
background (`index.css:236`, just `overflow-anchor`). iOS Safari paints the overscroll/address-bar
regions from the **document (html)** background — so when an iOS repaint dropped the body's paint, the
unstyled document (white) showed through while the `theme-color` meta kept the chrome themed.
**Fix:** `html { @apply bg-background }`. The theme class lives on `<html>` (theme-provider.tsx:45) and
`--background` is defined per theme, so it resolves to the current theme, same as `<body>` — the two
can no longer diverge. Guard: `tests/overscroll-bg.spec.ts` asserts `<html>` bg is non-transparent and
equals `<body>`'s.

## Bug 3 — blue Registration Bar flashes on Sharing-View load (HIGH, Clerk-only)
`shared-link-auth-controller.tsx:38` computed `registerMode = !isSignedIn` without gating on Clerk's
`isLoaded`. Pre-load, `isSignedIn` is `undefined` → `registerMode` true → the blue bar mounted (with
CommitBar's `slide-in-from-bottom` animation) and then unmounted once auth resolved for a signed-in
recipient — a flash. **Fix:** thread `authResolved={isLoaded}` into `SharedLinkView` (new prop,
**defaults true** so the no-Clerk test build is unchanged) and gate the Registration Bar branch on it:
`registerMode ? (authResolved && !registerDismissed && !retiring && <RegistrationBar/>) : (…)`. During
Clerk's pre-load window nothing mounts; the correct bar appears once, after resolution. Tiles still
render meanwhile. Clerk-only, so live/device QA (the CI build has no Clerk).

## Bug 1 — clock tile bleeds ABOVE the sticky hero on scroll (BEST-EFFORT, device-QA)
IMG_0068 (happy theme) showed the SYDNEY tile painted *above* the pinned hero. This is the 2026-07-19
compositing bleed: the `transform: translateZ(0)` hint on `.hero-sticky`/`.sticky-layer` is present but
no longer holds on iOS 26. **Fix (escalation):** alongside `translateZ(0)`, added `will-change:
transform` + `backface-visibility: hidden` (`-webkit-` too) to both — the canonical "persistently
promoted, clean-repainting GPU layer" set. Deliberately layout-safe: avoided `isolation`/`contain`,
which would risk the z-40/55/70 drawer stacking or the hero-shrink. **Not reproducible in Playwright or
desktop Safari** — needs device QA. If it still bleeds, the documented next levers are
`viewport-fit=cover` + `env(safe-area-inset-*)` or a JS scroll-driven approach (larger, separate).

## Verification
- `tsc --noEmit` + `build` clean. **75 Playwright tests pass** (74 + the new bug-2 guard).
- Bugs 1 & 3 are not CI-testable (iOS-compositor / Clerk-only) → device QA:
  1. Scroll the dashboard (esp. happy theme): no tile bleeds above the hero.
  2. Toggle a side-panel setting: the status-bar/address-bar region stays the theme color, no white flash.
  3. Open a shared link while signed in: the blue Registration Bar never flashes.
- Skipped the 2-critic design loop (opt-in).
