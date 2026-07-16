# Happyhour — Status

Last updated: 2026-07-16

**Status:** In progress · **Live:** <https://happyhour.day> · **Stack:** Vite + React 18 + TS + Tailwind, static (Cloudflare Pages, auto-deploys on push) · **Repo:** `khoivinh/happyhour`

World clock + timezone converter (fka Khlock). No backend; weather via Open-Meteo (no API key).

## Current state
- **2026-07-16 — merged to `main` (`7b3291c`), live on happyhour.day.** Incoming `?z=` links land on a new **Sharing View** (Figma `344:3787`) rather than a modal asking "Add shared clocks?" before showing anything: cities run live, checks are interactive, already-owned ones lock, and the 16-cap pre-checks what fits instead of truncating after you agree. The "two strokes" in Happy select mode was **a border that never painted** — `border-transparent` beat every state's `border-[…]` — with an inset ring standing in for it; same bug on the commit bar. Happy's `--tile-sel-border` retuned by CIELAB measurement (47.2 → 5.7), dark followed. Also: Copy Link, a shared `CommitBar`, 3px tile margins, per-theme highlight, and a fix for shared links flashing the recipient's own board. 52 tests, 520 runs green. → `docs/2026-07-16-devlog.md`
- **2026-07-16 — the project's first test suite** (merged alongside the above). There had never been one: every past "N assertions pass" came from scratchpad scripts, all since wiped. `@playwright/test` committed properly; runs against a **prod build**, since `analytics.ts` no-ops unless `import.meta.env.PROD`. → `docs/2026-07-16-devlog.md`

Older entries: `STATUS-archive.md`.

## Next steps
- Judge the four design calls below **live on happyhour.day** — they shipped as-is, unresolved
- Sign off or revert dark's select stroke `#5c4f2a` → `#473d21`: done per "no darker than needed in each of the three modes", but you only asked about Happy. One token
- Copy calls: "Room for one more — Happyhour holds 16." is drafted, not specified; and the surface says "time zones" (headline, per Figma) vs "cities" (bar, per spec) for one object
- Does the locked gray check read as "already added" or as disabled? Spec says gray check; the HIG critic argues gray is the vocabulary for *inert* and wants a caption
- Should selected tiles in the Sharing View get a fill tint? Spec says "Hover State at all times" — written before checks became interactive — so selection now rests on the check glyph alone
- Real-device QA: the Add collapse and select-mode feel; confirm the `share_*` events land
- A11y: `SiteFooter` renders inside `<main>`, so the footer isn't a `contentinfo` landmark on any page
- `isDropdownOpen` / `isBeingDragged` hardcode light-mode hexes with only a `dark:` variant, so Happy falls through to light — same family as the token just fixed
- Fold into the queued cookie-modal redesign: its save button reads "Accept all" even when saving Analytics *off*
- Decide whether the Figma capture script (`mcp.figma.com/.../capture.js` in `index.html`) should ship to prod
- Wire `npm test` into CI — no workflow exists, so the suite is local-only
- Verify iOS home-screen icon + Android Chrome tab favicon on real devices; device check of mobile drag (dnd-kit); mobile header alignment tweak

## Pointers
- Key files: `client/src/pages/world-clock.tsx`, `components/digital-clock.tsx`, `components/time-zone-converter.tsx`, `components/logo-bar.tsx`, `components/shared-link-view.tsx`, `components/commit-bar.tsx`, `components/share-selection-bar.tsx`
- Tests: `npm test` (Playwright, `tests/`). Runs against a **prod build** — `analytics.ts` no-ops unless `import.meta.env.PROD`, so a dev server can't exercise analytics or the consent gate. Analytics assertions read `window.dataLayer`. The config builds with `VITE_CLERK_PUBLISHABLE_KEY=` empty on purpose: a local `.env` key would compile in and mount `<ClerkProvider>`, so CI would test a different `App.tsx` branch than your machine.
- Share flow: link schema `/?z=<city keys>[&t=<epoch ms>]` (`URLSearchParams` percent-encodes the commas as `%2C`; round-trips fine); `t` only in custom-time mode. **Sending:** select mode + link build in `time-zone-converter.tsx` (reports up via `onShareModeChange`); menu + tile selection in `digital-clock.tsx`. **Receiving:** `world-clock.tsx` parses `?z=` and renders `shared-link-view.tsx` *instead of* the board, held back by a `sharePending` flag read synchronously from the URL — the keys resolve async, and mounting the board first both flashes it and strands the geo notice. Both bars share the `commit-bar.tsx` shell, which reserves the footer clearance on mount.
- Strokes: judge a tile stroke against **its own fill**, never against the page — that misreading is what gave Happy `#eab700` at ΔE 47 vs light's 5.7. All three now sit at ~5.7. Use `cn()` for the tile's class chain: `border-transparent` and a state's `border-[…]` have equal specificity, so plain interpolation lets CSS source order decide, and Tailwind emits `border-transparent` last — which silently killed every colored border. `tests/share-selection.spec.ts` guards it.
- Timed UI in tests: `page.clock.install()` does **not** freeze time (it ticks along with it). Use `install()` + `pauseAt(Date.now() + 60_000)`, aimed ahead because the fake clock ticks between the two calls.
- Header geometry is one interlocked system: `TOGGLE_TOP` (world-clock.tsx) sets the drawer icon **and** the menu panel; `LogoBar`'s padding and `.hero-clock`'s padding-top must land on the same baseline. Change one, re-measure all four.
- Design doc: `docs/PRD.md` · Devlogs: `docs/` (latest 2026-07-16)
- Share flow + refinements are live on `main` (`5b5b9c1`). Branch previews live at `<branch>.khlock.pages.dev` — the Pages project is still named `khlock`, so it is *not* a `happyhour.day` subdomain.
