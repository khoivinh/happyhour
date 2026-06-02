# Happyhour — Status

Last updated: 2026-06-02

**Status:** In progress · **Live:** <https://happyhour.day> · **Stack:** Vite + React 18 + TS + Tailwind, static (Cloudflare Pages, auto-deploys on push) · **Repo:** `khoivinh/Khlock` (legacy name)

World clock + timezone converter (fka Khlock). No backend; weather via Open-Meteo (no API key).

## Current state
- 2026-06-02: fixed sub-hour relative offset (India UTC+5:30 was rounding to whole hours via `Math.round`) in `time-zone-converter.tsx` + `digital-clock.tsx`. `tsc --noEmit` clean.
- 2026-04-25 polish batch shipped: cookie banner/modal fixes, ancillary-header parity with the home header, copy + link cleanup, mobile favicon + `manifest.json`, and a theme-color status-bar fix (per-theme tint rewritten in `theme-provider.tsx`).

## Next steps
- Browser/device QA on the visual polish
- Verify iOS home-screen icon + Android Chrome tab favicon on real devices
- Device check of mobile drag (dnd-kit)
- Playwright coverage on the cookie flow + new routes (About / Privacy / Support)
- Mobile header alignment tweak

## Pointers
- Key files: `client/src/pages/world-clock.tsx`, `components/digital-clock.tsx`, `components/time-zone-converter.tsx`
- Design doc: `docs/PRD.md` · Devlogs: `docs/` (latest 2026-04-25)
