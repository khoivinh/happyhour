# 2026-08-01 — Share message, east-to-west ordering, and the custom-time picker

Four edits from `Scratch/2026-08-01-happyhour-edits.md`, plus the tests for them. Second devlog of
the day; the first (`2026-08-01-devlog.md`) was the iCloud husk cleanup and changed no app code.

## 0. Setup check first

The session opened with a repo-health pass, since the previous one had found the working directory
lying about repo state.

| Check | Result |
|---|---|
| Branch / tree | `main`, clean |
| Build | succeeds, 2.87s |
| Tests before this work | 75/75 pass |

**`node_modules` is a plain directory, not the `node_modules.nosync` symlink — and that is now
correct.** The repo lives on local disk at `~/Developer/Happyhour`; `find -flags +dataless` reports
**0 evicted files**. The relocation solved the iCloud eviction problem outright, so the `.nosync`
workaround is obsolete here. STATUS.md carried it as a next step and as a pointer warning about
"this iCloud-synced repo" — both retired in this commit.

## 1. Five-minute picker steps — tried, then abandoned same day

**Shipped as `step={300}` on all four `<input type="time">`, then reverted. The feature is dropped;
only the keyboard commit below survives.**

The reasoning I gave for `step` was wrong. I claimed the native iOS/Android wheels honor it and only
desktop typing escapes — that was the basis for choosing `step` alone over rounding, and it doesn't
hold. Device QA showed the iOS wheel still offering every minute.

What's actually true:

- **`step` is a validity constraint, not a picker constraint.** MDN defines it as "only values which
  are a whole number of steps from the step base are valid" and promises nothing about picker
  granularity.
- **iOS never receives it.** The wheel is a separate implementation (`WKContentViewInteraction`)
  that doesn't get these constraints — the same architecture that makes `min`/`max` inert there
  ([WebKit #225639](https://bugs.webkit.org/show_bug.cgi?id=225639), filed 2021, still `NEW` as of
  Feb 2026).
- **Chromium declined on purpose.** [Issue 40705754](https://issues.chromium.org/issues/40705754) is
  exactly `<input type="time" step="300"> still shows every minute in dropdown`, resolved **Won't
  Fix** — they allow selecting invalid values in the picker, mirroring the fact that you can type
  one.

So no browser snaps a time picker to `step`. Enforcing five-minute increments would have required
either rounding a typed value on commit, or hand-building the control (a `<select>` of five-minute
values — structurally sound, since a select can't emit a value it doesn't list, but it means owning
12/24-hour conversion that `<input type="time">` does for free, plus a second editor to maintain
across four render sites).

**Neither was worth it, so the requirement was dropped rather than approximated.** `step` is gone —
leaving it in would have implied a guarantee that isn't there. A test now pins the *absence* of
granularity, so a future change that starts snapping values is a conscious one.

## 1b. Keyboard commit (kept)

Return commits. **Escape cancels — a deliberate departure from the note, which asked for both keys
to commit.** Escape already means cancel twice in this app (share select-mode at
`time-zone-converter.tsx`, the Sharing View's drop to resting at `shared-link-view.tsx`) and means
cancel everywhere else on the platform.

**The subtle part:** both keys `stopPropagation()`. Those other two bindings listen on `document`,
so an un-stopped Escape would close the editor *and* tear down share mode in a single keystroke.
`tests/time-picker.spec.ts` covers exactly that sequence — Escape closes the editor with the share
bar still up, and a second Escape then exits share mode as it always did.

## 2. "Cancel" → "Done", on both bars

The sender's select-mode bar and the recipient's Sharing View bar. Leaving select-mode keeps the
board exactly as it was — no selection is undone, nothing is torn down — so "Cancel" promised a
reversal that never happened.

`testId`s keep their original names (`button-share-cancel`, `button-share-import-cancel`) so
existing specs and analytics stay put. The comments naming the old label were updated alongside;
stale comments are worse than none.

## 3. Shared cities always read east-to-west

The share previously inherited **grid order**, so the same three cities produced different links
depending on the order they were tapped. Now `shareKeys` sorts.

The comparator the "Sort East to West" preference already used was extracted to a module-level
`byEastToWest()` and applied in both places, so the two features can't drift on what the phrase
means. The `?z=` payload, the recipient's tiles, and the OG preview all inherit the ordering.

**The local city sorts into position** rather than staying pinned first — it's one of the cities
being shared, not a header.

## 4. The share message

New `client/src/lib/share-text.ts`. A link says nothing until it's opened; this is the readable half
that rides with it.

```
live    Current time in Tokyo 9:00 PM JST GMT+9/Paris 2:00 PM CEST GMT+2/New York City 8:00 AM EDT GMT-4
custom  Tokyo 9:00 PM/Paris 2:00 PM/New York City 8:00 AM
```

The live form names zones; the custom form doesn't. A conversion has a fixed instant with the zones
implied by the cities, so naming them is noise — whereas a live share is a snapshot of *now*, and
the zone is what tells the reader how stale the number already is by the time they read it.

Details that mattered:

- **Times follow the reader's 12/24-hour preference** and mirror the tile formatting exactly
  (24-hour pads the hour, 12-hour doesn't and carries AM/PM).
- **Zone identification degrades properly.** Abbreviation + offset where a curated abbreviation
  exists, offset alone otherwise. Only ~40 zones are curated, so the fallback is the common case —
  and it must not read `GMT+7 GMT+7`.
- **The share sheet gets `text` and `url` as separate fields**, so targets that understand a URL
  render their own preview card instead of finding a link buried in prose. The clipboard, which
  takes one string, gets them joined with the URL last and alone on its line, where chat clients
  still detect and unfurl it.

Separator is `/` per the note — commas would collide with city names like "New York City, NY".

## Decisions

- **Escape cancels rather than commits** (see §1b). The only departure from the written notes;
  raised before implementing and confirmed.
- **The five-minute increment requirement was dropped, not approximated** (see §1). `step` can't
  deliver it on any platform, and the two things that could — rounding typed input, or a
  hand-built control — were both judged worse than not having it. Better to leave the editor
  honest than to ship a constraint that holds on desktop and silently doesn't on a phone.
- **Cities are named by `city.name`**, so the string reads "New York City", not "New York" as the
  notes' shorthand had it. `formatCityDisplay` would have added ", NY" — extra noise in a message
  meant to be skimmed.
- **`share-text.ts` is tested through the browser, not as a pure function.** It depends on the
  runtime-loaded city lookup and the `@/` alias, so a Node-only spec (the `functions/lib/preview.ts`
  pattern) would test neither the data nor the wiring.
- **Tests pin the clock with `setFixedTime`, not `install` + `pauseAt`.** The suite's usual idiom
  fails here: the fake clock ticks during page load, so the target instant is already in its past by
  the time the page is ready. `setFixedTime` is the right tool when only `Date.now()` needs pinning.
- **Two typos in the source notes corrected:** `GTM-4` → `GMT-4`, and a stray `PM` in the 24-hour
  example (`Paris 21:00 PM`).

## Tests

**84 pass, up from 75.** Two new files (the `step` attribute test went with the feature):

| File | Covers |
|---|---|
| `tests/time-picker.spec.ts` | Return commits; Escape abandons; Escape doesn't tear down share mode; any minute is settable (no granularity) |
| `tests/share-text.spec.ts` | exact live string; clipboard payload shape; `?z=` ordering; custom-time form omits zones; both bars read "Done" |

The share-text specs seed cities **deliberately out of east-to-west order** (Paris, Tokyo, New York),
so a correctly-sorted result can only have come from sorting — not from accidentally inheriting the
seed order.

## Next steps

- **Live QA on a real phone.** The share sheet's two-field `{text, url}` handling is
  target-dependent — iMessage, WhatsApp, Mail and Slack each compose text and URL differently, and
  some will show the link twice if they append it to the text. This is the main thing CI can't
  reach.
- **Judge the message length with a full board.** Sixteen cities produce a long string; some share
  targets truncate. Not solved preemptively — worth a look once it's been used in anger.
- **DST at a distant custom instant.** Both the east-to-west sort and the share text use each zone's
  *current* offset, so a custom share set months out could order or label zones by today's DST state.
  Documented in both call sites and deliberately left alone.
- Optional: align the edge OG-preview copy (`functions/lib/preview.ts`) with the new ordering — it
  already inherits the sorted `?z=`, but its own "N locations" phrasing is untouched.
