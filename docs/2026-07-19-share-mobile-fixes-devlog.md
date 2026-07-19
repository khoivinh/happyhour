# 2026-07-19 — Share View mobile bug fixes

From `Obsidian/Scratch/2026-07-19-happyhour-edits.md`. Khoi sent a Sharing View link to a friend on
iOS 26.5 / Safari / iPhone 16 and hit four issues. Three are mobile rendering/robustness bugs; one is
a visual cleanup. Shipped in one pass on top of the round-2 + drawer work (`d7dfaf5`).

## Fixes

### 1. Removed the extraneous full-width rule under the branding
The Sharing View showed two stacked rules: the sticky `LogoBar`'s own full-width bottom border, and
the body-column-width `border-t` above the headline. Dropped the header border (`logo-bar.tsx`:
`border-b border-border` removed from the sticky className), leaving only the body-width rule Khoi
wanted (`shared-link-view.tsx:188`, untouched). The header keeps its solid `bg-background`, so tiles
still scroll cleanly under it. Updated the `logo-bar.tsx` doc comment, which had promised a bottom
rule "to divide it from the tiles."

### 2. Weather reliability — retry + backoff
"WEATHER UNAVAILABLE" on every tile was a genuine Open-Meteo fetch failure, not share-specific: the
Sharing View uses the identical `useWeather` path as the dashboard. A shared link mounts all tiles at
once, firing a burst of parallel requests; on mobile 4G a transient failure with only `retry: 1`
surfaced the error immediately (there's no loading branch — pending renders blank, error renders
"unavailable"). `use-weather.ts`: `retry: 1` → `retry: 3` with exponential `retryDelay`
(`Math.min(1000 * 2 ** attempt, 8000)`). Blips now recover silently — the tile stays blank, never a
premature error, until retries are exhausted. `staleTime`/`refetchInterval` (10 min) unchanged.

### 3 + 4. iOS Safari compositing glitches (blank-until-scroll + body bleeds above the sticky header)
Same iOS Safari family, two symptoms: half the page paints blank on a shared link until a scroll
forces a repaint, and scrolling content bleeds up *above* the pinned branding. The second symptom
also shows on the dashboard's sticky hero ("TOKYO above PARIS" in Khoi's screenshot). Two changes,
both **medium-confidence / device-QA** (not reproducible in Playwright or desktop Safari):

- **Share View runway** (`world-clock.tsx`): the `<main>` min-height is now conditional —
  `min-h-[100dvh]` on the Sharing View, the unchanged `min-h-[calc(100lvh+120px)]` on the board. The
  `lvh`+120 runway exists only for the dashboard's hero-shrink feedback loop (a documented fixed-point
  bug); the Sharing View has no hero, so that oversized runway was pure dead space that also fed the
  compositing glitch. `dvh` tracks the live viewport, so content is never taller than what's visible
  on first paint. The board branch is verbatim — `dvh`/`svh` there would break the hero shrink.
- **Compositing hint on both sticky surfaces** (Khoi chose "Both surfaces"): a new
  `.sticky-layer { transform: translateZ(0); }` in `index.css`, applied to the `LogoBar` sticky
  header; and `transform: translateZ(0)` added inline to `.hero-sticky`. `translateZ(0)` on the
  sticky element (not an ancestor) forces a clean, isolated GPU layer so it repaints without bleed.
  Verified the hero still pins and `--hero-ratio` scroll-shrink is unaffected (transform on the
  sticky element is safe; only transform on an *ancestor* collapses stickiness).

## Verification
- `tsc --noEmit` + `build` clean. **72 Playwright tests pass.**
- New guard in the existing drawer test (`share-import.spec.ts`): the Sharing View branding `<header>`
  now has `border-bottom-width: 0px` — catches the full-width border creeping back.
- **Untestable (iOS-compositor-specific), live QA:** fixes 3 & 4. Khoi re-tests the shared link on the
  friend's setup (iOS 26.5 / iPhone 16) — content paints fully on first load, no bleed above the
  pinned branding, weather resolves; and on the dashboard the hero still shrinks with no bleed.
- Skipped the 2-critic design loop (opt-in; Khoi judges live).

## Notes / follow-ups
- No `viewport-fit=cover` / `env(safe-area-inset-*)` change — the layout viewport already begins below
  the iOS status bar. If the bleed persists after the compositing fix, safe-area handling is the next
  lever (larger, separate change).
