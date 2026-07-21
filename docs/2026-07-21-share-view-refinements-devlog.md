# 2026-07-21 — Sharing View refinements (round 2 of the day)

From `Obsidian/Scratch/2026-07-21-happyhour-edits.md`. Four small refinements — two label/type tweaks,
two Sharing-View bug fixes. Shipped on top of the same-day Time Zone Names work.

## Changes

### 1. Side panel: "Show Relative Time" → "Relative Time"
One label in `sidebar.tsx`. Matches the new "Time Zone Names" row (also no "Show" prefix).

### 2. Relative-time pill font +1
The `+5HR` / `NEXT DAY` pill was `text-[8px]`; bumped to `text-[9px]` in both the desktop and mobile
meta lines (`digital-clock.tsx`). The offset and the Next/Prev-Day chip share the wrapper, so both grow.

### 3. Sharing View: the divider under the sticky branding no longer scrolls away
**Bug:** on 2026-07-19 the branding's own full-width rule was removed, leaving only the body-width rule
on the content `<section>` (above the headline). But that section scrolls, so once the recipient
scrolled, the pinned branding had nothing under it. **Fix (per Khoi):** the divider now *sticks with
the branding*. Moved a **body-width** `border-b border-border` onto the `LogoBar`'s inner `max-w-4xl`
container (only when `sticky`), and dropped the section's `border-t`. One rule, pinned directly under
the branding, visible at all times. Deliberately on the inner container, **not** the full-width
`<header>` — the 2026-07-19 "no full-width rule" preference still holds, and the existing header-border
guard (`border-bottom-width: 0px`) still passes. Added `pb-[10px]` on the inner container so the rule
keeps its ~10px gap below the wordmark. Same `--border` token, so the happy-theme `#a3922a` is unchanged.

### 4. Sharing View: "Relative Time" toggle was a no-op → now disabled/grayed
**Bug:** `showRelativeTime` never reached `SharedLinkView`, so toggling it in the Sharing View did
nothing. Rather than wire it through, Khoi's call was to **disable** it there — the recipient's own time
isn't on screen, so there's no anchor for a relative offset to be meaningful. `ToggleSwitch` gained a
`disabled` prop (inert `onClick`, `aria-disabled`, `opacity-40 cursor-not-allowed`); `Sidebar` takes
`relativeTimeDisabled`, and `world-clock.tsx` passes `Boolean(shareImport)` — grayed in the Sharing
View, normal on the board. (Sort East-to-West is technically a no-op there too but wasn't in scope.)

## Verification
- `tsc --noEmit` + `build` clean. **74 Playwright tests pass.**
- Extended the existing "carries the drawer toggle and side panel" test (`share-import.spec.ts`): the
  full-width `<header>` stays `border-bottom-width: 0px` **and** its inner container now has `1px`
  (guards the pinned rule both ways); the Relative Time switch is `aria-disabled` while 24-Hour is not.
- Skipped the 2-critic design loop (opt-in).

## Notes
- Visual nuance to QA live: the pinned rule now reads as attached to the branding, with a touch more
  space (~35px vs ~25px) before the headline — the tradeoff of moving it onto the sticky header.

## Follow-up (same day) — rule flush to the header's bottom edge
Khoi flagged that the pinned rule floated ~10px above the sticky header's bottom edge (the header's own
`pb-[10px]` sat *below* the rule) and asked it to define the edge like the dashboard hero. Fix: the
sticky header now drops its bottom padding (`pb-0` when sticky; `pb-[10px]` otherwise), so the inner
container's `border-b border-border` lands flush on the header's bottom edge — content scrolls right up
to it. The 10px gap is now only *above* the rule (branding → rule), and rule → headline is 25px, matching
the dashboard hero's `border-b border-border` + `pt-[25px]` exactly (same token, same 1px weight — those
already matched). Guard added: the sticky branding `<header>` now asserts `padding-bottom: 0px`. 74 tests.
