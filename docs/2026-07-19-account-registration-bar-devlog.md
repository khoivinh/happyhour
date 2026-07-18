# 2026-07-19 — Account Registration Bar

From `Obsidian/Scratch/2026-07-18-happyhour-account-flow.md`. Happyhour already has Clerk auth (the
sidebar's "Login or Sign Up" opens a Clerk modal), but nothing ever *prompts* an anonymous visitor
to register. This adds an **Account Onboarding** nudge: once a signed-out user has added a clock,
a blue **Registration Bar** invites them to save it with a free account. Built on the existing
`CommitBar` primitive; reuses the same Clerk sign-in modal. No new dependencies.

## Behavior (confirmed with Khoi)

- **Trigger — added-this-session only.** The bar appears only after the visitor adds a clock during
  the current session (a manual add *or* accepting shared clocks). A returning signed-out user who
  loads the page and adds nothing does **not** see it. → in-memory state, no localStorage.
- **Dismissal — session only.** Cancel hides it for the rest of the session; it can reappear on a
  future visit per the trigger. Also in-memory. Signing in ends it permanently (the component
  returns `null` once `isSignedIn`).

## What shipped

**New `client/src/components/registration-bar.tsx`.** A thin wrapper over `CommitBar`. Calls
`useAuth()` and renders `null` when signed in — so signing in from the bar dismisses it for free.
Copy "Save your clocks with a free account" (left, white); a ghost **Cancel**; and a **Login or Sign
Up** pill wrapped in Clerk's `<SignInButton mode="modal">`.

- Verified against the installed Clerk (`@clerk/clerk-react@5.61.4`) that `SignInButton` **composes**
  the child's click — it runs the child `onClick`, then opens the modal, and clones with
  `{...rest, onClick}` (no ref). So wrapping the function-component `CommitBarButton` is safe (no ref
  warning), and the button's own `onClick` fires — used it for a `registration_prompt_login_clicked`
  event rather than a dead placeholder.

**Blue skin — `client/src/index.css`.** A `.registration-bar` wrapper overrides the seven
`--share-bar-*` vars (custom properties cascade into `CommitBar`'s fixed child by DOM ancestry, so
`CommitBar` itself is untouched): blue `#4e82ee` surface (matching the sidebar Login button), white
copy, a white/blue submit pill (accent inverted from the share bar), white Cancel, transparent
border. Deliberately theme-independent — blue in light/dark/happy alike, unlike the per-theme share
bar.

**Wiring — `client/src/pages/world-clock.tsx`.** Owns the two in-memory flags (`addedThisSession`,
`regDismissed`). `handleAddShared` sets `addedThisSession` when `added.length > 0`; a new
`onClockAdded` callback on `<TimeZoneConverter>` sets it on a manual add. The bar renders as a
sibling of the view conditional, gated:
`isClerkConfigured && addedThisSession && !regDismissed && !shareActive && !shareImport`. The
`isClerkConfigured` guard (same const the sidebar/use-cloud-sync use) keeps `useAuth()` from running
without a provider; the mutually-exclusive conditions guarantee exactly one bottom bar is ever
mounted, so `CommitBar`'s footer-clearance reservation never doubles.

**`client/src/components/time-zone-converter.tsx`.** Added optional `onClockAdded?: () => void`,
fired in `handleAddClock` right after `track("city_added")` — i.e. only on a real add, past the
MAX/duplicate early-returns.

## Analytics

Three events (untyped `track()`, no analytics.ts change): `registration_prompt_shown` (on mount),
`registration_prompt_dismissed` (Cancel), `registration_prompt_login_clicked` (submit).

## Verification

- `tsc --noEmit` + `build` clean. **70 Playwright tests still pass** (all changes additive/gated).
- Confirmed `.registration-bar{...}` is in the built CSS.
- **No new automated test.** The test/CI build compiles with `VITE_CLERK_PUBLISHABLE_KEY=` empty on
  purpose, so `isClerkConfigured` is false and the bar never mounts under Playwright — the same
  untested Clerk branch as the sign-in modal. Live/manual QA, like the round-5 About tagline and
  happy-theme cookie button.
- Skipped the 2-critic design loop (opt-in; Khoi judges live).

## Live QA checklist (Clerk-configured build)

Signed out: add a clock → blue bar (white copy, white/blue "Login or Sign Up", white "Cancel");
submit opens the Clerk modal. Cancel hides it; more adds this session don't rebring it; a reload
shows no bar until a fresh add. Sign in → gone and stays gone. Open a `?z=` share, accept clocks →
land on the board with the bar up; no bar while the Share View / share-select bar is up. All three
themes stay blue and legible; with the cookie banner up, the bar steps above it.

## Notes

- The onboarding welcome tagline (hero, top) and the Registration Bar (bottom) coexist on a
  brand-new visitor's first add — different surfaces. Judge live.
- Not yet pushed — awaiting Khoi's go.
