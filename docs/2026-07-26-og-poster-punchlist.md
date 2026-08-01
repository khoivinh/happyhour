# OG poster art — punchlist

**Status:** Spec for redrawing `client/public/og.png`. Diagnosis in
`docs/2026-07-26-og-art-feasibility.md`; this is the actionable list.
**Date:** 2026-07-26

## Why

The poster reads fuzzy on X and Facebook and clean on Slack and iMessage. Cause: those platforms
re-encode OG images to **JPEG with 4:2:0 chroma subsampling**, which preserves brightness detail but
halves colour resolution in both directions. The current art defines its text almost entirely by
*colour* (saturated yellow on pure black) with very thin strokes, so the letterform edges land
precisely in the data being thrown away.

Measured through an identical encode, mean absolute error (lower = survives better):

| Variant | Error |
|---|---|
| Yellow on black, 4:2:0 (today) | **5.34** |
| Yellow on black, 4:4:4 | 3.07 |
| White on black, 4:2:0 | **2.35** |

Same letterforms, same encoder — white comes through clean. **The problem is colour and stroke
weight, not resolution.**

## Measured state of the current file

| Property | Current |
|---|---|
| Canvas | 2400 × 1260 (declared in HTML as 1200 × 630) |
| Colour mode | RGBA — verified 100% opaque, alpha channel unused |
| Palette | `#000000` 89.1% · `#FFD900` 5.3% · `#FFCD05` 3.9% · `#FFFFFF` 0.9% |
| Content margins | L 166px · R 156px · T 168px · B 156px (≈6.5–6.9%) |
| Wordmark stroke | 53px @2400 → **12.5px** at feed size — survives fine |
| Tagline strokes | 7px @2400 → **1.5–1.8px** at feed size — destroyed |
| Text band heights | 92px and 114px @2400 → 23px and 28.5px at feed — **size is fine** |

The key number: at the ~600px wide a card actually renders in a feed, the small text has **1.5px
strokes**, and chroma subsampling leaves roughly half that in colour information.

---

## P1 — Fixes the reported problem

- [ ] **1. Move all small text from yellow to white** (`#FFFFFF`). Legibility must ride on
      brightness contrast, not colour. This single change is ~2.3× improvement on its own.
      Applies to the "It's always that time somewhere!" line, currently `#FFD900`.
- [ ] **2. Roughly double the stroke weight of all body text.** Size is already fine — do this with
      **font weight, not point size**. Target **≥6px stroke in a 1200px-wide canvas** (≈3px at feed
      size). Current is 3.5px at 1200. In practice: Light/Regular → **Medium or Semibold**.
- [ ] **3. Keep yellow only for large, heavy shapes** — the wordmark and the smiley mark. Their
      50px+ strokes survive subsampling comfortably. Never put yellow on a thin stroke again.
- [ ] **4. Lift the background off pure black** to `#0D0D0D`. Gives the encoder a little luma signal
      to anchor edges against. Visually indistinguishable, measurably kinder to the compressor.
- [ ] **5. No gradients, drop shadows, glows or soft tonal transitions.** They band and ring badly
      under JPEG. The current art correctly has none — keep it that way.

## P2 — Correctness bugs found along the way

- [ ] **6. Export at 1200 × 630**, not 2400 × 1260. Cards display at ~600px CSS width, so 1200 is
      already the retina asset; 2400 just forces platforms to do a bigger downscale with their own
      (often crude) filter. Shipping 1200 means we control the resample.
- [ ] **7. Flatten to RGB — drop the alpha channel.** Verified every pixel is fully opaque, so it's
      pure dead weight and forces every consumer to flatten before encoding.
- [ ] **8. Fix the declared dimensions** in `client/index.html:26-27`. They currently say
      1200 × 630 while the file is 2400 × 1260. After item 6 they become correct as written —
      **verify, don't assume.**
- [ ] **9. Keep the file as PNG.** Lossless source means platforms encode from clean pixels. Do not
      pre-compress to JPEG.
- [ ] **10. Unify the two yellows, or make the difference deliberate.** The wordmark and tagline are
      `#FFD900`; the mark is `#FFCD05`. They read as the same colour but aren't. `#FFCD05` is the
      app's mark colour (`happyhour-logo.tsx:24`); `#FFD900` is the Happy theme background.

## P3 — Robustness, lower priority

- [ ] **11. Consider a centred safe area.** Some surfaces show a square thumbnail. A 630×630 centre
      crop of a 1200-wide canvas keeps only **x 285–915** — which would cut *both* the smiley mark
      and part of the wordmark today. Fully honouring this would constrain the design hard, so the
      realistic goal is: make sure **at least one** identity element (mark or wordmark) survives a
      square crop. Confirm whether this case matters before designing around it.
- [ ] **12. Add `og:image:type`** = `image/png` and **`og:image:alt`** to `client/index.html`.
      Neither exists today. `alt` is an accessibility win and some platforms surface it.

## Acceptance test

Before shipping, run the redrawn file through the same pipeline that exposed the problem:

1. Downscale to 600px wide with a good filter.
2. Re-encode as JPEG quality ~72 with 4:2:0 subsampling.
3. Zoom to 4× and compare against the clean downscale.

Pass condition: **no visible colour fringing, mosquito noise or background speckle around any text**.
The comparison harness used for the diagnosis is a ~20-line PIL script and can be rerun on demand.

Then verify live with the real consumers — Facebook Sharing Debugger, X Card Validator, and a paste
into Slack and iMessage. Note that all of them cache aggressively; force a re-scrape rather than
trusting a stale preview.

## Note on scope

This punchlist covers the **static** poster. It is worth doing regardless of whether dynamic
per-share art ever ships — under the client-render route it remains the fallback image, and every
constraint above (white for small text, heavy strokes, no thin yellow) applies verbatim to a
generated poster, which will be re-encoded by exactly the same platforms.
