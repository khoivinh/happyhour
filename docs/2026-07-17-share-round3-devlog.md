# 2026-07-17 — Share round 3: the Sharing View becomes a place

Second session today (the first fixed two recipient-side bugs). This one reshapes the Sharing View
from a transitory prompt into a surface the recipient can keep, plus a batch of copy/color/commit-bar
cleanups. From `Obsidian/Scratch/2026-07-17-happyhour-edits.md`. Built on branch `sharing-view-round3`.

## The headline change — a persistent Sharing View

The Sharing View used to strip its URL on arrival, die on Cancel, and be unrecoverable. The note's
framing: its purpose is to *present useful clocks*, not to push the recipient to add them — so it
should behave like something you keep, not a dialog you answer once.

- **Refresh keeps it.** Removed the mount-time `replaceState` that stripped `?z=`/`?t=`
  (`world-clock.tsx`). The params now persist, so a refresh re-enters the view. `handleAddShared`
  clears the URL to `/` once the share is *consumed* — so refreshing after adding shows the board,
  not the view.
- **Cancel dismisses only the bar.** A local `mode: 'select' | 'resting'` inside `SharedLinkView`.
  Cancel drops from Select Mode to Resting (bar gone, view stays); it no longer tears the view down.
  The parent keeps `shareImport` set throughout; `onCancel` became `onDismiss` (analytics only).
- **Resting state.** Tiles lose the pinned hover skin (they read as normal live clocks) and each
  gains the ellipsis (⋯) menu with a single item, **"Save {city}"**. Selecting it re-enters Select
  Mode with *only that city* pre-checked — distinct from arrival, which pre-checks everything that
  fits. Implemented as a new `onSave` prop on `DigitalClock`; the existing ellipsis `Popover` gate
  widened from `onShare` to `onShare || onSave`, and the Sharing View passes only `onSave`.
- **Logo is the way out.** `<LogoBar linkHome={Boolean(shareImport)} />` makes the logo a real
  `<a href="/">` in the view. Chose a **full navigation** over SPA history on purpose: Back then
  reloads the shared URL and re-enters the view, which is far more reliable than reconstructing it —
  wouter ignores the query string, so a same-route popstate wouldn't re-fire the parse. The cost is a
  brief flash, accepted.
- **Live ticking.** `SharedLinkView` computed time once (fine when transitory, wrong for a kept
  surface). Added a `now` state on a minute interval; a shared instant (`&t=`) stays frozen until…
- **Reset Time.** …the recipient clicks a right-aligned **Reset Time** link above the first tile
  (only shown while frozen), styled to match the hero's own reset link. It flips the tiles to live.

## Smaller items

- **Copy → "clocks".** "Add Time Zone" → **Add Clock**; headline "N time zones" → "N clocks shared
  with you"; commit-bar "Add these cities" → "Add these clocks"; privacy page "cities you've added" →
  "clocks". Deliberately kept "cities" in the search box (you search by city name) per Khoi's answer.
- **Wordmark ink.** Was pure `#000000` (light/happy) / white (dark). Now tracks `--foreground`, the
  same token as the hero clock — #333 light, #1A1A1A happy, #E6E6E6 dark — so the wordmark stops
  reading as a purer black than everything else. Khoi asked what the hero clock used before deciding;
  the answer (`text-foreground`) was the decision. Logo *glyph* left black.
- **Drawer icon, theme-aware.** Was a hardcoded `#6B7280`/`#C4C7CC` with no per-theme variant. Now
  `text-muted-foreground` (normal) and `text-muted-foreground/40` (inert). This fixes two bugs at
  once: Happy's normal state now matches the "Add Clock" button (#4D4D4D, not #6B7280), and the inert
  state is *always* lower-contrast than normal — so dark stops inverting (its old #C4C7CC read
  brighter than #6B7280 on a dark ground). The alpha modifier works because the token is defined as
  `hsl(var(--muted-foreground) / <alpha-value>)`; there's no `happy:` Tailwind variant, so opacity is
  the robust route.
- **Copy Link → inline "Copied".** Dropped the toast and the auto-dismiss. The button now swaps its
  own label to "Copied" for 3s (timer cleared on unmount) and the bar stays up — copying a link isn't
  committing the share. Removed the now-unused `toast` import.
- **Share N → no dismiss.** Removed the `cancelShareMode()` after the native sheet returns; the bar
  is stable so the user can copy too or share again.

## Verification

- `tsc --noEmit` + `build` clean.
- **61 Playwright tests pass** (56 → 61). New: refresh re-enters, logo→board→Back restores, Save
  re-enters Select Mode with one city, Reset Time drops the frozen instant, live share has no reset
  link. Rewrote the Cancel test (now asserts resting, not board). Sending side: Copy Link asserts
  inline "Copied" + bar stays; Share asserts bar stays.
- **Mutation-tested both new guards.** Removing the `inSelect` bar gate fails the Cancel-resting and
  Save tests (and nothing spurious); restoring the URL strip fails refresh + logo/Back but not the
  add-then-reload test (correctly independent — that one relies on the Add-time cleanup).
- **Visually verified across all three themes** (arrival, resting + ellipsis menu, Save→reselect,
  frozen + Reset Time, headers): screenshots in scratchpad.

## Open / notes

- Skipped the formal 2-critic design loop this round in favor of Khoi judging live — these are
  refinements to a surface that already passed the gate. Can run it if he wants.
- Two design judgment calls to eyeball live: the Reset Time link's vertical gap above the tiles, and
  whether resting tiles reading as flat (no fill) on the Happy yellow is right or wants a subtle edge.
- The `share_link_opened` event now re-fires on refresh (URL persists). Left as-is; dedupe is a
  one-liner if Khoi wants it.
- Pre-existing, out of scope: the arrival highlight is hardcoded light-yellow regardless of theme.
