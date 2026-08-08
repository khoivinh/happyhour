# Sharing Options popover — plan of record

**Status:** approved and **executed** 2026-08-08. Kept as the record of what was decided and why;
outcomes and the things that only surfaced during implementation are in `2026-08-08-devlog.md`.

**Superseded in part:** §5 describes an earlier, 8-entry abbreviation map. What shipped is the
168-city list in `Scratch/2026-08-08-happyhour-city-abbreviations.md`, whose rules replace §5's
inclusion rule. §5's two scope calls — share text only, always-on, no fourth toggle — did survive.

**Source brief:** `Scratch/2026-08-08-happyhour-sharing-options.md`.

---

## Context

The Sidebar's toggles serve two masters. `24-Hour Clock` and `Time Zone Names` are the user's
preferences for **their own dashboard**, but `buildShareMessage` reads those same two values when it
composes a share (`time-zone-converter.tsx:449-453`). So changing what a recipient sees means
changing your own board, and there is nothing on screen that says so. The Commit Bar's one share
control — the `Include Happyhour link` checkbox — governs a third thing entirely.

This round decouples them: the Commit Bar gets its own set of sharing options in a popover, and the
Sidebar goes back to describing only the user's view.

**Two decisions taken during planning:**

1. **Relative time is not in the popover.** It has no meaning in share text without an anchor the
   reader can see, and `buildShareText` has no concept of it today. Three toggles ship:
   24-Hour Clock, Time Zone Name, Happyhour link. The Sidebar keeps its own Relative Time row
   untouched.
2. **City abbreviations ship, restricted to known ones.** A small curated map, applied in share text
   only — see *§5*.

---

## What ships

### 1. Share preferences become their own persisted state

Three new prefs, owned alongside the existing share state in `time-zone-converter.tsx` (near `:357`),
persisted to `localStorage` with the house `world-happyhour-*` convention:

| Pref | Key | Default | Replaces |
|---|---|---|---|
| `shareUse24Hour` | `world-happyhour-share-24h` | `false` | reading `use24Hour` prop |
| `shareShowZoneAbbr` | `world-happyhour-share-zone-abbr` | `false` | reading `showZoneAbbr` prop |
| `shareIncludeLink` | `world-happyhour-share-link` | `true` | existing `includeLink` (`:365`) |

Follow the default-ON idiom at `world-clock.tsx:86-89` for `shareIncludeLink` (branch on `null`, not
`=== "true"`, or every returning user silently loses the link). One `useEffect` writer per pref,
matching `world-clock.tsx:137-155`.

**Deliberately localStorage-only, not cloud-synced.** Adding a pref to `useCloudSync` means touching
five places plus the worker endpoint, and carries the legacy-default hazard documented at
`use-cloud-sync.ts:31-33`. Out of scope; note it in the devlog as a follow-up.

**Behavioural change to watch:** `enterShareMode` (`:383`) and `cancelShareMode` (`:402`) currently
reset `includeLink` to `true`. Those resets must be **removed** — a remembered preference that resets
every time you open the bar is not remembered.

Then repoint `buildShareMessage` (`:447-458`) at the three new values and update its deps array. The
`use24Hour` / `showZoneAbbr` props stay — the tiles still need them.

### 2. Extract `ToggleSwitch`

It is a private function in `sidebar.tsx:21-45` and there is no `ui/switch.tsx`. Move it verbatim to
`client/src/components/toggle-switch.tsx`; import it in both `sidebar.tsx` and the new popover. Do not
restyle it — matching the Sidebar exactly is the requirement.

### 3. New `client/src/components/sharing-options-popover.tsx`

Build on `@radix-ui/react-popover` **directly**, not on `ui/popover.tsx`. That wrapper bakes in
`w-72`, `collisionPadding`, and a set of `data-[state=*]` zoom/slide animations that fight this spec;
it is also shared by three call sites in `digital-clock.tsx` that should not be disturbed. Radix still
buys click-outside dismiss, Escape, focus return, and **trigger-click-to-dismiss** (a doc
requirement) for free.

**Trigger** — replaces the checkbox in the bar's left slot (`share-selection-bar.tsx:47-64`).
Reuse `CommitBarButton variant="secondary"` so the gray matches Copy Link by construction rather
than by copied hex. This requires wrapping `CommitBarButton` in `React.forwardRef` and spreading
`...rest` so Radix's `asChild` can attach — a small, safe change to `commit-bar.tsx:114`.
`data-testid="button-sharing-options"`.

**Positioning** — `side="top"`, `align="start"`, `alignOffset={-16}`. The offset cancels the
CommitBar inner pill's `px-4` (`commit-bar.tsx:86`) so the popover's left edge lands on the *bar's*
left edge, not the trigger's. Radix's `PopoverArrow` points at the trigger's centre independently of
`alignOffset`, which is exactly the specified tail behaviour.

**Surface** — Sidebar's skin, per the doc: `bg-[#333]`, `rounded-[15px]`,
`shadow-[0_1px_2px_rgba(0,0,0,0.15)]`. Height hugs content (no fixed height). Rows are the Sidebar's
`flex flex-col gap-[20px]` group, each row `flex items-center h-[28px]` with the label class copied
verbatim from `sidebar.tsx:327`:
`flex-1 font-medium text-[14px] leading-[22px] tracking-[-0.43px] uppercase text-[#efefef]`.

*Flag:* `#333` is a fixed dark surface floating above a Commit Bar that is white in light mode and
yellow in happy mode. This follows the doc's explicit instruction ("same background color" as the
Sidebar, which is itself un-themed) — the design critique in step 5 is where to confirm it holds up
in all three themes.

**Close button** — circled X at top right. `lucide-react`'s `X` inside a bordered round button; the
Sidebar's own close affordance is a custom drawer icon, so this one is new. `aria-label="Close
sharing options"`.

**Animation** — new `@keyframes sharing-options-open` / `-close` in `index.css`, placed next to
`sidebar-open` (`:357-386`) and reusing its `cubic-bezier(0.32, 0.72, 0, 1)`. Same clip-path-inset
technique, origin moved to the **bottom-left** (the trigger) so it grows bottom-to-top, and faster
per the doc — ~220ms open / ~160ms close vs the Sidebar's 350/250. Mirror the Sidebar's delayed
content fade-in (`sidebar.tsx:285-289`). Drive both off Radix's `data-[state=open|closed]`; Radix's
Presence waits for the exit animation, so the close case works without `forceMount`.

> **Gotcha:** `clip-path: inset(0 0 0 0)` clips to the border box, which would sever the arrow. Put
> the clipped surface `div` and `PopoverArrow` as **siblings** inside `PopoverContent`, so only the
> surface is clipped. Verify in a screenshot — a silently missing tail is the likely failure here.

### 4. Escape-key precedence

`time-zone-converter.tsx:411-418` has a document-level Escape listener that tears down share mode.
With the popover open, Escape must close only the popover. Guard it — either lift the popover's open
state and skip the share-mode handler while it's true, or call `stopPropagation` in Radix's
`onEscapeKeyDown`. This is the same class of bug as the time-picker Escape interaction already
guarded by `time-picker.spec.ts:64`; it needs its own test.

### 5. Known city abbreviations

A curated `cityKey → short name` map beside `ZONE_ABBR` in `client/src/lib/city-lookup.ts:155-197`,
whose shape and fallback behaviour it copies exactly. Exported accessor:

```ts
/** The name a city goes by in a shared message. Falls back to the full name — the map is a short
 *  list of abbreviations in genuine everyday use, not a naming scheme. */
export function shareCityName(city: TimezoneOption): string {
  return CITY_ABBR[city.key] ?? city.name;
}
```

Called from the one place city names enter share text, `share-text.ts:80` — `city.name` becomes
`shareCityName(city)`. Nothing else changes.

**Inclusion rule:** an abbreviation a reader parses cold, in real written use. Not airport codes
(NYC alone has three), not invented contractions ("PAR", "BLR"), not slang registers.

Keys verified against the real dataset — every one resolves to a clean base key with no
collision suffix, since each is the highest-population instance of its name:

| Key | Dataset name | Ships as |
|---|---|---|
| `newYorkCity_US` | New York City | `NYC` |
| `losAngeles_US` | Los Angeles | `LA` |
| `sanFrancisco_US` | San Francisco | `SF` |
| `washington_US` | Washington | `DC` |
| `hongKong_HK` | Hong Kong | `HK` |
| `riodeJaneiro_BR` | Rio de Janeiro | `Rio` |
| `hoChiMinhCity_VN` | Ho Chi Minh City | `HCMC` |
| `kualaLumpur_MY` | Kuala Lumpur | `KL` |

Note `washington_US` is stored as plain `"Washington"` — so `DC` is not merely shorter here, it
disambiguates from the state and the four other Washingtons in the dataset.

**Held back for your review, not shipped** — each fails the rule in a different way, listed in the
devlog: `CDMX` (ubiquitous in Spanish, uneven in English), `Vegas` and `Philly` and `NOLA`
(colloquial register rather than abbreviation).

**Two deliberate scope calls, both easy to reverse:**

- **Share text only — the OG card keeps full names.** `functions/lib/preview.ts:34-50` builds a
  headline (`"Current time in New York City & 2 more"`) where there is room and clarity is worth
  more than brevity; the inline text is scanned in a thread, where it isn't. Keeping it out also
  avoids duplicating the map into `functions/lib/` and regenerating it through
  `scripts/build-city-names.mjs`, which `preview.ts:5-9` would otherwise force.
- **Always on, no toggle.** The popover stays at three rows as decided. Gating it later is one
  condition in `shareCityName`.

*Watch for:* with Time Zone Name also on, a segment reads `8:00 AM EDT NYC` — three initialisms in a
row. Worth an eye during the critique pass in §6; the fix, if it reads badly, is to prefer the full
name whenever the zone is shown.

### 6. Design critique loop

Requested explicitly by the doc. Screenshot the open popover in light / dark / happy at desktop and
mobile widths, then — per the tiered dispatch rule — **one** sweep agent over all six screenshots
(≤600 words, no WebFetches), and **at most two** follow-up passes on whatever it flags. Hard cap: 3
agents. Checks: tail alignment and presence, the `#333`-over-themed-bar question, optical alignment
of the popover's left edge to the bar, and animation feel against the Sidebar.

---

## Tests

`npm test` (Playwright, chromium, against a production build — `playwright.config.ts:34`).

**Breaks (2), both in `tests/share-text.spec.ts`** under `describe("the Happyhour link checkbox")`:
`:113` and `:131`. Both click `checkbox-include-local` directly. Per the precedent set by
"Cancel"→"Done" and "Include my local time"→"Include Happyhour link" (`share-selection-bar.tsx:44-46`),
**keep `data-testid="checkbox-include-local"` on the popover's link row**. Fixing the two tests is
then just an opening click on `button-sharing-options`, plus swapping `aria-pressed` for whatever
role the row lands on.

**New coverage:**
- Trigger opens the popover; clicking the trigger again dismisses it; the X dismisses it.
- All three toggles survive a page reload (the "remembered from session to session" requirement).
- 24-Hour on in the popover with the Sidebar's own 24-Hour **off** produces 24-hour times in the
  clipboard while the tiles stay 12-hour — the decoupling, asserted directly.
- Escape with the popover open closes it and leaves share select-mode standing.
- A share containing New York City copies as `NYC`; one containing Paris still copies as `Paris`
  (the fallback path, which is what protects the other 30,473 cities).

Pin the clock with `setFixedTime` and never snapshot-compare `text-hero-time` across an interaction
(`STATUS.md`, and the rule recorded in commit 9d3fa55).

**Untested layout risk:** `useCommitBarClearance` hardcodes `104 / 132`px (`commit-bar.tsx:57`). The
trigger button (~44px) is taller than the checkbox it replaces (~22px), which grows the **mobile**
two-row bar; desktop is unchanged since the buttons already set that row's height. Measure the mobile
bar and raise the 132.

---

## Devlog

`docs/2026-08-08-devlog.md` records, beyond the change itself:

- The four abbreviations held back and why each fails the inclusion rule.
- Why abbreviations stop at share text and don't reach the OG card.
- Relative-time-in-share deferred, and the three anchors that were considered.
- Share prefs not cloud-synced, and the five-file cost of changing that.

---

## Files

| File | Change |
|---|---|
| `client/src/components/sharing-options-popover.tsx` | **new** — the popover |
| `client/src/components/toggle-switch.tsx` | **new** — extracted from `sidebar.tsx:21-45` |
| `client/src/components/share-selection-bar.tsx` | checkbox → popover trigger |
| `client/src/components/commit-bar.tsx` | `forwardRef` on `CommitBarButton`; mobile clearance |
| `client/src/components/time-zone-converter.tsx` | 3 persisted prefs; `buildShareMessage`; Escape guard; drop the resets |
| `client/src/components/sidebar.tsx` | import the extracted `ToggleSwitch` |
| `client/src/index.css` | `sharing-options-open` / `-close` keyframes |
| `client/src/lib/city-lookup.ts` | `CITY_ABBR` map + `shareCityName()`, beside `ZONE_ABBR` |
| `client/src/lib/share-text.ts` | `city.name` → `shareCityName(city)` at `:80` |
| `tests/share-text.spec.ts` | fix 2; add the decoupling, persistence + abbreviation tests |
| `docs/2026-08-08-devlog.md`, `STATUS.md` | **new** devlog; refresh status |

## Verification

1. `npx tsc --noEmit` — clean.
2. `npm test` — full suite green (92 passing today, plus the new cases).
3. `npm run build && npm run preview`, then by hand:
   - Enter share mode, open Sharing Options, toggle each of the three, **reload**, re-enter share
     mode — all three hold.
   - Set Sidebar 24-Hour **off** and popover 24-Hour **on**; Copy Link; confirm the clipboard is
     24-hour while the board is 12-hour.
   - Turn the link off; confirm Copy Link yields times only and the native sheet gets no `url`.
   - Share New York City + Paris; confirm the text reads `NYC` and `Paris`, and that the unfurled
     link preview still says "New York City" — the deliberate split in §5.
   - Escape with the popover open closes only the popover.
   - Screenshot all three themes at desktop and mobile; confirm the tail is present, centred on the
     trigger, and that the popover's left edge sits on the bar's left edge.
4. Run the capped design-critique loop on those screenshots; apply what it lands.
