# 2026-07-19 — Account Flow Round 2: zero defaults, auth-aware Sharing View, Back fix

From `Obsidian/Scratch/2026-07-19-happyhour-account-flow.md`. Follow-up to the shipped Registration
Bar. Three things: new users start empty (pre-seeding cities they never chose was disorienting), the
Sharing View becomes auth-aware, and a Back-button regression is fixed.

## Decisions (confirmed with Khoi)
- **Post-auth in the Sharing View (doc-faithful, Option A):** a **new registrant** → shared clocks
  auto-added + taken to the board (highlighted); a **returning** user who logs in → stays in the
  Share View with the Commit Bar. Told apart by Clerk account age (`user.createdAt ≈ now`). Heuristic;
  the rare misread is a harmless auto-add.
- **One round** (single commit/deploy).
- Registration Bar button **"Cancel" → "Later"**.

## Main View
- **Onboarding copy** (`time-zone-converter.tsx`): "Welcome to the indispensable time zone tool." →
  **"Track clocks and convert time zones for up to sixteen cities"**.
- **Zero default clocks:** `initZonesFromStorage()` now returns `[]` on every path (no stored key,
  unparseable, and — critically — the stored-but-empty case that used to re-seed via
  `migrated.length > 0 ? … : DEFAULT_ZONES`). Removed `DEFAULT_ZONES`. A user who clears their board
  stays at zero. The sticky hero clock stays (it's the user's *local* time, London only until geo
  resolves — not an unasked-for city); the tagline is the empty-state prompt.

## Registration Bar
- Ghost button label "Cancel" → "Later" (`registration-bar.tsx`). Same `registration_prompt_dismissed`
  event.

## Sharing View — auth-aware
The signed-out (register) path is **Clerk-only**, so it's kept out of the no-Clerk test build, where
`SharedLinkView` stays in its unchanged Commit-Bar mode and every existing share test passes.

- **`DigitalClock` — `showSelectCheck?: boolean` (default true).** When `isSelectMode &&
  !showSelectCheck`, the outer check `<div>` (row geometry) stays but the inner 17×17 `<span>` gets
  `invisible` — the exact no-shift trick the grip slot uses. Also gated the full-tile select **tap
  layer** on `onToggleSelect` being present, so the display-only register preview doesn't lay a dead,
  focusable button over each tile (safe: `onToggleSelect` is truthy in every real select mode).
- **`SharedLinkView` — `registerMode` prop.** True (signed-out recipient): render the blue
  **`RegistrationBar`** instead of the Commit Bar; tiles are display-only (`showSelectCheck={false}`,
  no `onToggleSelect`/`onSave`) with identical layout. "Later" hides the bar (logo escapes). An effect
  re-derives the pre-checked `selected` set when `registerMode` flips false, since a returning user's
  owned board arrives from cloud-sync only after login. False → today's Commit Bar, verbatim.
- **New `shared-link-auth-controller.tsx` (Clerk-only).** Isolates all Clerk hooks so `SharedLinkView`
  and `world-clock`'s top level stay provider-free. Computes `registerMode = !isSignedIn`; on the
  ref-latched sign-in edge (baseline-latched so an *already*-signed-in open isn't mistaken for a
  registration), branches on `createdAt`: new → `onAdd(keys)` (auto-add all → board); returning →
  no-op (Commit Bar reveals). `world-clock` mounts the controller when `isClerkConfigured`, else the
  plain `SharedLinkView` (test path).

## Back-button fix
The regression had two causes: `handleAddShared` did `history.replaceState` (dropped `?z=`, nothing to
Back to), and the `?z=` parse was a mount-only effect reading `location.search` imperatively (popstate
wouldn't re-parse). Fix:
- Extracted the parse into `resolveShareFromLocation()` (a `useCallback`), called from the mount effect
  **and** a new `popstate` listener. A `shareResolveToken` ref guards against a stale async resolve
  winning over a newer one.
- `handleAddShared` now **`pushState`s** the clean URL on top of the `?z=` entry, so Back restores the
  shared URL and popstate re-enters the view — a pure SPA transition (wouter ignores the query string).
  Forward returns to the board. The round-3 logo escape (full `<a href="/">` reload) is unaffected.

## Verification
- `tsc --noEmit` + `build` clean. **71 Playwright tests pass** (70 existing + 1 new).
- **New Back test** (`share-import.spec.ts`, no-Clerk-safe): seed a board, open a `?z=` share, Add →
  board with merged tiles + clean URL; Back → the share view re-appears with `?z=` restored (in
  resting mode, since the recipient now owns both cities — the all-owned skip holds).
- **Untestable (Clerk branch), live QA:** the signed-out register mode (checkless tiles, "Later", the
  new-vs-returning auto-add). The no-Clerk build exercises the Commit-Bar path, so existing tests are
  unaffected.
- Skipped the 2-critic design loop (opt-in; Khoi judges live).

## Notes / follow-ups
- Reused the main-view Registration Bar copy ("Save your clocks with a free account") in the share
  context. Flag if share-specific copy is wanted.
- Minor load flash: during the brief Clerk resolve, a recipient defaults to register mode; an
  already-signed-in user sees checks a beat late. Clerk resolves fast from cookie — live judge.
- `share_link_opened` re-fires on Back re-entry (same as the existing refresh-re-enter behavior);
  dedupe is still a one-liner if wanted.
- Not yet committed/pushed — building for review, ship in one round on Khoi's go.
