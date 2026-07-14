# Happyhour — Status

Last updated: 2026-07-14

**Status:** In progress · **Live:** <https://happyhour.day> · **Stack:** Vite + React 18 + TS + Tailwind, static (Cloudflare Pages, auto-deploys on push) · **Repo:** `khoivinh/happyhour`

World clock + timezone converter (fka Khlock). No backend; weather via Open-Meteo (no API key).

## Current state
- 2026-07-14: **`alt-header` branch (not merged)** — logo bar + hero clock now read as one unit. Header de-stuck and de-ruled, mark moved right of the wordmark; hero shrinks continuously on scroll (96→36px) and its rule locks to the top of the viewport, so only one rule is ever visible. Drawer toggle is now genuinely pinned (it previously drifted ~7.5px) — measured identical at every scroll offset, Δ0.00px against the sidebar close icon. Figma `329:3241` / `329:3521`. See `docs/2026-07-14-devlog.md`.
- 2026-06-14: fixed Safari/macOS slashed zeros in the time-edit input (`<input type=time>` uses tabular figures; Zalando Sans's tabular `0` is slashed). Pinned `proportional-nums` + disabled the `zero` feature in `digital-clock.tsx`. `tsc --noEmit` clean.
- 2026-06-02: fixed sub-hour relative offset (India UTC+5:30 was rounding to whole hours via `Math.round`) in `time-zone-converter.tsx` + `digital-clock.tsx`. `tsc --noEmit` clean.
- 2026-04-25 polish batch shipped: cookie banner/modal fixes, ancillary-header parity with the home header, copy + link cleanup, mobile favicon + `manifest.json`, and a theme-color status-bar fix (per-theme tint rewritten in `theme-provider.tsx`).

## Next steps
- Evaluate `alt-header` on a Cloudflare per-branch preview (don't merge to look — `main` auto-deploys to prod)
- Browser/device QA on the visual polish
- Verify iOS home-screen icon + Android Chrome tab favicon on real devices
- Device check of mobile drag (dnd-kit)
- Playwright coverage on the cookie flow + new routes (About / Privacy / Support)
- Mobile header alignment tweak

## Pointers
- Key files: `client/src/pages/world-clock.tsx`, `components/digital-clock.tsx`, `components/time-zone-converter.tsx`
- Design doc: `docs/PRD.md` · Devlogs: `docs/` (latest 2026-06-14)
