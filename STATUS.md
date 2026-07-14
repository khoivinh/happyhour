# Happyhour — Status

Last updated: 2026-07-14

**Status:** In progress · **Live:** <https://happyhour.day> · **Stack:** Vite + React 18 + TS + Tailwind, static (Cloudflare Pages, auto-deploys on push) · **Repo:** `khoivinh/happyhour`

World clock + timezone converter (fka Khlock). No backend; weather via Open-Meteo (no API key).

## Current state
- 2026-07-14 (round 3): top baseline nudged **22px → 32px** (drawer icon, wordmark, sticky city name — they share one baseline by design), which pushes the menu panel off the viewport edge (**4px → 14px**). The panel's position is *derived* from the icon (`top: topOffset − 18`, matched by the panel's `pt-[18px]`, so its close icon lands on the toggle) — it can't be moved independently. Logo bar extracted to `components/logo-bar.tsx`: the padding was a copy-pasted literal in 3 files, and its "these match" comment had already gone stale twice. Sticky rule 115→125.
- 2026-07-14 (merged): **`alt-header` → `main`**, fast-forward, deployed to production. Merge caught one straggler: the ancillary headers (About/Privacy/Support/404) still had round 1's `pt-[29px]` while home moved to `pt-[13px]` in round 2 — a 16px jump on navigation, under a comment promising there was none. Fixed and measured: wordmark ink top is 22px on all five pages at both breakpoints (`b2daa7f`).
- 2026-07-14 (round 2): **`alt-header`** — feedback fixes. The scroll "shudder" turned out to be **browser scroll anchoring**, not the document-height feedback I first diagnosed: the hero's shrink made Chrome nudge `scrollTop`, which drives the shrink, which re-triggered the nudge. `html { overflow-anchor: none }` + a `min-h-[calc(100lvh+120px)]` scroll runway. Ratio now reaches exactly 1 at the reported repro (was stuck at 0.56, oscillating). Also: geo notice moved to the footer, hero tap target narrowed off the drawer icon, sticky zone/temp → 12px, icon top → 22px (aligns with the city name when sticky and the wordmark at top).
- 2026-07-14: **`alt-header` branch (not merged)** — logo bar + hero clock now read as one unit. Header de-stuck and de-ruled, mark moved right of the wordmark; hero shrinks continuously on scroll (96→36px) and its rule locks to the top of the viewport, so only one rule is ever visible. Drawer toggle is now genuinely pinned (it previously drifted ~7.5px) — measured identical at every scroll offset, Δ0.00px against the sidebar close icon. Figma `329:3241` / `329:3521`. See `docs/2026-07-14-devlog.md`.
- 2026-06-14: fixed Safari/macOS slashed zeros in the time-edit input (`<input type=time>` uses tabular figures; Zalando Sans's tabular `0` is slashed). Pinned `proportional-nums` + disabled the `zero` feature in `digital-clock.tsx`. `tsc --noEmit` clean.
- 2026-06-02: fixed sub-hour relative offset (India UTC+5:30 was rounding to whole hours via `Math.round`) in `time-zone-converter.tsx` + `digital-clock.tsx`. `tsc --noEmit` clean.
- 2026-04-25 polish batch shipped: cookie banner/modal fixes, ancillary-header parity with the home header, copy + link cleanup, mobile favicon + `manifest.json`, and a theme-color status-bar fix (per-theme tint rewritten in `theme-provider.tsx`).

## Next steps
- Confirm the prod deploy of the new header on happyhour.day (Cloudflare builds on push to `main`)
- Real-device QA on the scroll shrink — it's a feel thing, not a screenshot thing
- Browser/device QA on the visual polish
- Verify iOS home-screen icon + Android Chrome tab favicon on real devices
- Device check of mobile drag (dnd-kit)
- Playwright coverage on the cookie flow + new routes (About / Privacy / Support)
- Mobile header alignment tweak

## Pointers
- Key files: `client/src/pages/world-clock.tsx`, `components/digital-clock.tsx`, `components/time-zone-converter.tsx`, `components/logo-bar.tsx`
- Header geometry is one interlocked system: `TOGGLE_TOP` (world-clock.tsx) sets the drawer icon **and** the menu panel; `LogoBar`'s padding and `.hero-clock`'s padding-top must land on the same baseline. Change one, re-measure all four.
- Design doc: `docs/PRD.md` · Devlogs: `docs/` (latest 2026-07-14)
- On `main` (`b2daa7f`); `alt-header` is merged and can be deleted. Branch previews live at `<branch>.khlock.pages.dev` — the Pages project is still named `khlock`, so it is *not* a `happyhour.day` subdomain.
