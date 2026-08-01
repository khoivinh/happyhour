# Dynamic OpenGraph art for share links — feasibility

**Status:** Research only. Nothing built, nothing scheduled, no architecture chosen.
**Date:** 2026-07-26

A findings document, written to answer "what's possible here?" before committing to an approach.
Two decisions gate everything below and are called out at the end.

## Context

A share link is `/?z=<cityKeys>[&t=<epochMs>]`. Since 2026-07-17 (round 4) a Pages Function makes the
preview *text* dynamic — `functions/_middleware.ts:38-42` uses HTMLRewriter to rewrite `og:title`,
`twitter:title`, `og:description`, `twitter:description`, `og:url` and `<title>` from
`buildPreview(z, t)` (`functions/lib/preview.ts:34`).

The **image is still static**, and the file says so at `functions/_middleware.ts:10`: *"The preview
image stays the static og.png; only text is dynamic."* That `client/public/og.png` is 2400×1260,
shows the wordmark, mark and tagline — no clocks — and was rendered in a different typeface than the
app uses. So a link sharing New York, Paris and London previews with art that says nothing about
New York, Paris or London.

**The goal:** poster art that reflects the actual selection — the cities, and their times.

## The hard constraint

Every "draw it on demand" route needs a rasterizer at the edge. The standard stack is
**Satori** (JSX/CSS → SVG, pure JS) + **`@resvg/resvg-wasm`** (SVG → PNG). It runs on Workers, but:

| Plan | Max bundle | CPU per request | Satori + resvg fits? |
|---|---|---|---|
| Workers Free | 3 MB | **10 ms** | **No** — a render is 50–200 ms |
| Workers Paid ($5/mo) | 10 MB | 30 s default (5 min max) | Yes, comfortably |

CPU is the wall, not code — a render is an order of magnitude over the free budget. Bundle is also
tight on free: resvg's wasm plus Satori plus an embedded font lands around 2.5–3.5 MB against a 3 MB
ceiling.

**The repo gives no direct evidence of which plan is active.** There is no `wrangler.toml` for Pages
at all (the only wrangler config, `api/wrangler.jsonc`, belongs to the separate `happyhour-api`
Worker). Pages is configured in the dashboard. Circumstantially it looks like free tier — one Worker,
one D1, no KV, R2, Durable Objects or Images bindings anywhere. **Confirm in the Cloudflare dashboard
before costing any of this**, since it decides between Route A and everything else.

Caching softens the cost but does not remove the wall: each unique `(z, t)` renders **once**, then
serves from the Cache API. The first crawl still has to fit the CPU budget.

## The routes

| # | Approach | Fidelity ceiling | Cost | Effort |
|---|---|---|---|---|
| **A** | Satori + resvg-wasm at `/og` | Near-pixel app parity | $5/mo | ~1–2 days |
| **B** | Browser renders at share time → R2/KV → `og:image` points at it | Exact *when the device cooperates* | Free tier | ~2–3 days |
| **C** | Third-party text-drawing CDN (Cloudinary et al.) | Approximate | Free-ish | ~half a day |
| **D** | Cloudflare Images binding | **Cannot draw text** | — | Dead end |
| **E** | SVG as `og:image` | — | — | Dead end |

**A — render at the edge.** A Pages Function at `/og` reads `?z=&t=`, reuses `CITY_NAMES` and the
same key parsing `buildPreview` already does, lays out tiles in Satori, rasterizes, caches
immutably. `_middleware.ts` gains two more rewrites (`og:image`, `twitter:image`) pointing at
`/og?z=…&t=…`. Cleanest architecture: one code path, works for *any* link including hand-edited
URLs, no storage lifecycle. Needs the paid plan.

**B — render in the sharer's browser.** At Copy Link / Share time the client draws the poster to a
canvas (or reuses the live DOM via `html-to-image`), POSTs the PNG to a Worker, which stores it in
R2 keyed by a hash of `(z, t)`. `_middleware` points `og:image` at the stored object, falling back
to `og.png` when absent. Sidesteps the CPU limit entirely because the user's device does the work.
Costs: new storage, a write endpoint, an upload-abuse story, and **any link not created in-app has
no image** — including a hand-edited URL, or an old link shared before the feature existed.

**C — third-party.** Encode cities and times into a Cloudinary URL with `l_text:` overlays;
`og:image` becomes that URL. Almost no code. But a vendor sees the contents of every share, brand
fonts must be uploaded there, and layout is limited to what their transformation grammar expresses.

**D — Cloudflare Images.** The Images binding composites and resizes images; it has **no text
drawing**. Pre-rendering glyph sprites and compositing digits one at a time is technically possible
and practically absurd. Ruled out.

**E — SVG.** Facebook, X, Slack and iMessage do not rasterize SVG for link previews. Ruled out.

*(For completeness: hand-rolling a PNG encoder over a pixel buffer, using `CompressionStream` for
the deflate and pre-baked glyph bitmaps for text, would avoid wasm entirely — but filling and
deflating a 1200×630 RGBA buffer almost certainly blows 10 ms too, for a large pile of custom code.)*

## Cross-cutting issues — these apply to every route

**1. The staleness problem, and it's the interesting one.** Platforms fetch an OG image once and
cache it, often indefinitely until manually re-scraped. So a poster showing a *live* clock is a
fiction: it freezes at first crawl. A frozen `&t=` share is exact forever; a live share previews
"4:16 PM in New York" and still says that next week, next to a link that opens showing the real
current time. Three ways out — show no clock face on live shares (city names, offsets, a day/night
indicator: all time-invariant); render the time with an explicit "as of…" caption; or accept the
drift. **This is a design call, not a technical one, and it should be settled before any pixels get
drawn.**

**2. Fonts — a different problem per route.** The numerals are **Zalando Sans 900**
(`--font-display`), pulled from Google Fonts at runtime (`client/index.html:35`).

*Under Route A (server-side):* Satori reads **ttf/otf/woff — not woff2**, so the file has to be
converted and committed to the repo. Subsetting to digits, colon and AM/PM makes it tiny; city names
need a Latin subset of Inter as well. Check the OFL terms before vendoring. Falling back to Inter for
the numerals loses the app's whole character. **Tractable and one-time** — once it's right, every
render is identical forever.

*Under Route B (client-side):* none of that applies — the browser already has the real fonts loaded.
But two new issues replace it:

- **The technique decides the work.** A `html-to-image`/foreignObject capture loads the SVG into an
  `<img>` as a *separate document* with no access to the page's stylesheets, so every font must be
  inlined as a base64 data URI or the text silently falls back to Times. (`fonts.gstatic.com` sends
  permissive CORS, so fetching them works — it's just a few hundred KB inlined per render.) A plain
  Canvas 2D `fillText` path avoids that entirely and only needs `await document.fonts.ready`, but
  hand-codes the layout, and `ctx.letterSpacing` — needed for the hero's −2.4px tracking — only
  exists in recent browsers.
- **Rendering is non-deterministic, and failures are sticky.** The poster is drawn on the *sharer's*
  device. If the webfont hasn't loaded when they tap Share, an off-brand poster gets uploaded and
  cached as that link's art permanently. iOS Safari has a long history of foreignObject + webfont
  bugs (often needing a throwaway warm-up render), which matters disproportionately because sharing
  is mostly a phone action. Device pixel ratio and antialiasing differ too, so two people sharing the
  same three cities can produce visibly different posters.

**So Route B trades a tractable one-time problem for a diffuse permanent one.** Mitigation is real
but adds scope: gate the capture on `document.fonts.ready`, sanity-check the result before upload,
and fall back to the static `og.png` rather than storing a bad poster.

**3. `CITY_NAMES` covers only the top 500.** `functions/lib/city-names.ts` has 500 entries against
30,481 cities, so an obscure-city share already previews as *"3 locations"*. A poster inheriting that
is much worse than a headline doing it — blank tiles instead of a vague noun. Already tracked in
`STATUS.md` as a build-step follow-up; a poster makes it close to a prerequisite. The generator
(`scripts/build-city-names.mjs`) replays the key algorithm verbatim and could emit the full map, but
that module would be sizeable against the bundle ceiling.

**4. Which theme?** The app has System/Light/Dark/Happy. The recipient's theme is unknowable
server-side, so the poster has to commit to one look. The Happy yellow (`#ffd900`) is the most
recognizable and the least likely to disappear against either a light or dark social feed.

**5. How many cities.** Shares carry up to 16; roughly 3–4 read legibly at 1200×630. `subjectFor()`
already caps the headline at 3 names + "& K more" (`functions/lib/preview.ts:19-26`) — the art should
mirror that rule rather than invent its own.

**6. There is no test coverage on the middleware.** `tests/preview.spec.ts` unit-tests `buildPreview`
in Node, but **nothing exercises `_middleware.ts`** — Playwright's `webServer` is `vite preview`,
which doesn't run Pages Functions. So the HTMLRewriter selectors have no guard today, and an image
route would land in the same blind spot. Closing it means either `wrangler pages dev` in the test
harness or a separate integration step.

## Where this lands

Two things gate the decision, and neither is code:

1. **The staleness question (1)** — does a live share's poster show a clock at all?
2. **The Cloudflare plan** — free or paid, confirmed in the dashboard.

If the plan is paid, Route A is clearly the best architecture and the rest is craft. If it's free and
staying free, Route B is the honest second choice, with two caveats worth weighing together: links
made outside the app never get art, and the poster's quality depends on the sharer's device (see 2).

Put plainly: Route A's costs are **known and bounded** — $5/mo and an afternoon of font plumbing.
Route B's costs are **open-ended** — device variance, silent font fallbacks, storage lifecycle, and
an upload endpoint to defend. The $5 buys determinism, which is worth more than it looks.

A cheap intermediate exists and is worth naming: **redraw the static `og.png` in the correct
typeface** and leave it static. It fixes the off-brand type and costs an hour, without touching
infrastructure — and it remains the fallback image under Route B regardless.

## Verification (whenever something is actually built)

- `buildPreview`-style Node unit tests for any new pure layout/selection logic, alongside
  `tests/preview.spec.ts`.
- `npx wrangler pages dev dist` + `curl` for the real function — the existing validation method for
  `functions/`, since `tsc --noEmit` never sees that directory.
- Visual check against the real crawlers: Facebook Sharing Debugger, X Card Validator, and a Slack
  and iMessage paste, at 1200×630 and on a retina phone.
- Confirm the Cache API actually hits on the second request for the same `(z, t)`.

## Sources

Cloudflare limits and the Satori/resvg-on-Workers constraints were checked against current docs and
write-ups rather than recalled:

- [Cloudflare Workers limits](https://developers.cloudflare.com/workers/platform/limits) — bundle size and CPU time, free vs paid
- [Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- [6 Pitfalls of Dynamic OG Image Generation on Cloudflare Workers (Satori + resvg-wasm)](https://dev.to/devoresyah/6-pitfalls-of-dynamic-og-image-generation-on-cloudflare-workers-satori-resvg-wasm-1kle) — static-wasm-import requirement, image-fetch and CSS-subset gotchas
- [Dynamic Open Graph Images with Cloudflare Workers](https://tom-sherman.com/blog/dynamic-og-image-cloudflare-workers)
- [Cloudflare Images: optimize with Workers](https://developers.cloudflare.com/images/transform-images/bindings/) — confirms compositing-only, no text drawing
- [Cloudflare Images pricing](https://developers.cloudflare.com/images/pricing/)
