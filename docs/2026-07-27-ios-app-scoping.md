# Happyhour for iOS — scoping

**Status:** Research only. Nothing built, nothing scheduled, no Xcode project created.
**Date:** 2026-07-27

A findings document, written to answer "what work would an iOS app take?" — full parity with the web
app, plus **widgets** and **Shortcuts actions**. Decisions already taken are recorded in §0; the rest
is analysis.

## 0. Decisions taken

| Decision | Value |
|---|---|
| Output of this session | This document only — no code, no PRD edit |
| Distribution target | **Public App Store release** |
| Minimum iOS | **18.0** |
| Code location | **`ios/`** inside the existing `happyhour` repo |

Min iOS 18 buys `ControlWidget` (Control Center / Lock Screen / Action Button) and modern App Intents
while keeping roughly two years of device reach. The repo is public, so the Swift source would be
too — there are no secrets in it (the Clerk publishable key is public by design).

## 1. Why this document exists

**The PRD already specifies an iOS app, and it is stale.** `docs/PRD.md:313-399` — "Track 2: iOS
Native App" — calls for SwiftUI, min iOS 17, WidgetKit `TimelineProvider`, App Groups, the Clerk iOS
SDK, a folder tree, and a 3-phase delivery. But it was written before most of the current product
existed. Concretely, it:

- says the dataset is a **"1500-city dataset from city-timezones"** (`PRD.md:327`) — it is **30,481
  cities** in a bespoke interned format;
- never mentions **App Intents, Shortcuts, or Siri** at all — the entire subject of half this request;
- predates **Sharing** (Track 3), **Relative Time**, **Time Zone Names**, the **Happy** theme, the
  **Registration Bar**, and the **empty-by-default board**;
- lists "Light/dark/system theme support" (`PRD.md:342`) — there are four appearance modes, not three.

Anyone starting from Track 2 today would build the wrong app. Track 2 should be replaced by this
document's §3–§8, not amended.

## 2. What has to be reproduced

The parity target, as it actually stands. This is the real scope — larger than the PRD's Track 2.

| Area | Detail |
|---|---|
| **Board** | Up to **16** tiles + a sticky **hero** clock. New users start with **zero** clocks (`time-zone-converter.tsx:275`), not a seeded set |
| **Hero** | City name, big time **with seconds**, AM/PM, GMT label, temp `xx°F / yy°C` colour-banded, or "Weather Unavailable"; "Reset Time" in custom mode. No picker, no menu, no drag |
| **Hero city detection** | `Intl` timezone match, then upgraded to nearest city by geolocation — an O(30,481) haversine scan (`closest-city.ts:29-42`), cached 24 h |
| **Tile** | Drag grip, city-name button opening a per-tile search picker, time, AM/PM, zone label, optional pill (**relative offset** `+9HR` / `+10.5HR`, and/or **Next Day / Prev Day**), temp, ellipsis menu (Share / Remove + confirm dialog) |
| **Custom time** | Tap any time → inline editor → every clock freezes to that instant; seconds and weather hide |
| **Reorder** | Drag-and-drop; desktop drags anywhere, touch from a 30 px edge strip. Manual reorder auto-disables Sort East-to-West |
| **Settings** | Appearance (System/Light/Dark/**Happy**), 24-Hour Clock, Sort East-to-West, Relative Time, Time Zone Names (**default ON**). No temperature-unit setting — both °F and °C always show |
| **Sharing** | Select mode → `https://happyhour.day/?z=key1,key2&t=<epochMs>` (`time-zone-converter.tsx:409-415`); `t` only when a custom time is frozen |
| **Sharing View** | Receiving `?z=` replaces the board entirely: headline, select/resting modes, grey locked checks for already-owned cities, "Add N" commit bar, Reset Time / Restore Custom Time |
| **Accounts** | Clerk; sync of zones + 4 toggles + theme via `GET/PUT /api/preferences`, `DELETE /api/account` |
| **Weather** | Open-Meteo, no key, per city, 10-min stale, 3 retries backing off to 8 s (`use-weather.ts`) |
| **Secondary** | `/about`, `/privacy`, `/support`, 404; offline banner; cookie consent; GA4 |

Size of the thing being ported: **47 files, 5,873 lines** in `client/src`, plus 479 lines of CSS
carrying three theme blocks.

## 3. Why native, and what loses

**Recommendation: native SwiftUI.** The alternatives and why they lose:

| Approach | Verdict |
|---|---|
| **Native SwiftUI** | **Recommended.** Full control, best widgets and Shortcuts, no bridging layer |
| WKWebView wrapper | **Rejected** — see below |
| Capacitor / React Native | **Rejected.** Reuses the React UI but widgets and App Intents are still Swift, and you inherit a bridge for an app this small |

The wrapper case deserves the argument, because it looks cheap:

1. **It doesn't avoid the hard part.** Widgets and App Intents *must* be Swift, and both need a
   native shared-data layer (an App Group store). A wrapper still requires building that layer — then
   leaves you maintaining state in two places at once, webview `localStorage` *and* the App Group,
   with a bridge keeping them honest. It saves the easy work and keeps the hard work.
2. **Guideline 4.2 ("Minimum Functionality")** rejects apps that are "a repackaged website." Native
   widgets and Shortcuts are exactly the differentiation that clears it — so the wrapper's headline
   advantage is partly illusory for a Store release anyway.
3. **The app is small.** 5,873 lines of React, with no date library and no server-side rendering.

**The strongest argument for native is that Foundation deletes a whole layer.** The web app's entire
timezone stack is hand-rolled over `Intl.DateTimeFormat` — offset parsing by regex
(`city-lookup.ts:94-116`), DST detection by comparing offsets at two instants, arithmetic `Date`
shifting to render another zone. `TimeZone` and `DateFormatter` replace all of it. There is no date
library to port because the web app has none.

## 4. Targets and module layout

XcodeGen `ios/project.yml`, mirroring `Code/Shotglass/mac/project.yml` — same commit-count
`CURRENT_PROJECT_VERSION` pattern, same `ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME` trick for
app-wide brand tint. That project is also the precedent for **ClerkKit**, which it already ships.

| Target | Type | Links |
|---|---|---|
| `Happyhour` | app | Core, Store, UI, CityDB, Networking, ClerkKit |
| `HappyhourWidgets` | widget extension | **Core, Store, UI only** |
| `HappyhourIntents` | App Intents extension | Core, Store, CityDB |
| `HappyhourKitTests` | unit tests | all |

A local package `ios/HappyhourKit` with five products. **The product boundary is a memory firewall,
not tidiness** — widget extensions run under a hard memory ceiling (~30 MB), so the 30,481-row
dataset must be structurally unreachable from the widget target:

| Product | Contents |
|---|---|
| `Core` | Models, zone-label logic, offset / relative-offset / day-badge math, temp colour bands, design tokens (4 themes), bundled fonts |
| `Store` | App Group reader/writer behind a protocol |
| `UI` | Widget-safe SwiftUI: clock face, tile, temp pill, day badge |
| `CityDB` | SQLite wrapper + the city dataset — **app and intents extension only** |
| `Networking` | Open-Meteo client, sync client, Clerk token plumbing |

Fonts are bundleable: **Zalando Sans is SIL OFL 1.1** (weights 600/900 for numerals), Inter for UI.

## 5. The city-key contract — the highest-risk item

Share links, saved boards, and the D1 `zones` column all key off a string like `tokyo_JP` or
`newYorkCity_US`. That key is **generated at runtime from the dataset**, not stored in it, by
`buildLookup()` at `client/src/lib/city-lookup.ts:244-297`:

- `normalizeForKey()` (`:239-242`) strips non-alphanumerics from `city_ascii` and lowercases the
  first character; base key is `` `${normalized}_${iso2}` ``.
- On collision, append `_{state_ansi || province}`; if still colliding, append the last IANA path
  segment.

**This walk is corpus- and order-dependent.** It iterates the population-sorted rows maintaining a
`usedKeys` set, so *any row's key depends on every row before it*. **333 of 30,481 rows collide on
the base key**, so the disambiguation branches are load-bearing, not edge-case handling.

Replaying the algorithm over the shipped dataset confirms it currently produces **30,481 unique keys
from 30,481 rows — zero survivors past both fallbacks**. That is a property of *this* corpus, not a
guarantee of the algorithm: there is no third fallback, and `usedKeys.add(key)` runs unconditionally,
so a three-way collision introduced by a future GeoNames refresh would have two cities silently share
a key and one disappear from `byKey`. The golden fixture below catches that too, which is a second
reason to want it.

A Swift reimplementation that differs in Unicode handling of `[^a-zA-Z0-9]` or in sort stability
would silently remap some of those 333 — producing dead share links, wrong cities restored from D1,
and a corrupted `zones` array on the next `PUT`. Nothing would throw. So:

1. **Never re-derive keys in Swift.** A build script (`scripts/build-ios-cities.mjs`, following the
   existing `scripts/build-*.mjs` + `npm run build:*` pattern) imports the *real* `buildLookup` and
   emits keys into the shipped database. One source of truth, not a port.
2. **Golden fixture:** SHA-256 over the sorted key list, asserted by a JS test *and* a Swift test that
   re-hashes the shipped database. Any dataset change that moves one key fails both builds.
3. Port the **18 legacy-key mappings** in `migrateOldKeys()` (`time-zone-converter.tsx:234-269`) —
   `paris` → `paris_FR`, plus a `newYork_US` → `newYorkCity_US` fix — or existing saved boards break.

**Adjacent finding, web-side.** `scripts/build-top-cities.mjs` slices the first 500 rows and lets
`buildLookup` re-derive keys *on that subset*. Because the subset is a strict population-ordered
prefix, the keys should agree with the full set — but nothing asserts it. Worth adding the same
fixture check to the web build regardless of whether iOS ever happens.

### Dataset format

| Option | Disk | Peak RAM | Verdict |
|---|---|---|---|
| Ship `cities.json` as-is | 2.1 MB | ~25–40 MB decoded | No — would blow the widget budget and slow cold start |
| Flat binary + hand-rolled index | ~1.6 MB | ~1 MB mmap | Fastest, but the most custom code to get wrong |
| **SQLite + FTS5** | ~3.5 MB | ~0.5 MB mmap | **Recommended** |

FTS5's `unicode61 remove_diacritics 2` reproduces the web's diacritic folding for free. Store
`key, name, name_ascii, tz_id, iso2, province, state_ansi, lat, lng, pop, rank`. Do **not** bake
`offset`/`gmtLabel` — they are DST-dependent and must come from `TimeZone` at runtime.

This also deletes complexity rather than porting it: the entire two-tier lazy-load scheme
(`cities-top.json`, `loadTopCities`/`loadCities`, `didFullCitiesFail()`, and the
`happyhour:tile-cache` workaround) exists solely to dodge a 2 MB parse in a browser. None of it
survives the move.

## 6. Shared data store

App Group `group.com.designdept.happyhour`. The design is the direct analogue of the web's
`tile-cache.ts`: resolved city metadata is **denormalized into the snapshot**, so no consumer needs
the city database to render.

| Artifact | Writer | Readers | Size |
|---|---|---|---|
| Settings scalars | app | app, widget, intents | <1 KB |
| `board.json` — `{key, name, tzID, iso2, lat, lng, order}` | app, `AddCity`/`RemoveCity` intents | widget, intents | ≤4 KB |
| `weather.json` — `{key: {tempC, fetchedAt}}` | app; widget on reload if stale | widget, intents | ~1 KB |
| Clerk session | app | intents | Keychain, shared access group |

Rules: coordinate writes with `NSFileCoordinator`; merge `weather.json` **per key by `fetchedAt`**
rather than clobbering the file; debounce `WidgetCenter.reloadAllTimelines()`.

The widget's render path is `board.json` → `TimeZone(identifier:)` → text. **Zero database access,
zero network on the hot path.**

## 7. Widgets

**The governing constraint: you cannot custom-render a ticking seconds display in a widget.**
`Text(date, style: .time)` self-updates on screen without consuming a reload and honours
`.environment(\.timeZone,)`, but you get system time formatting, not the app's typography. So widgets
are **minute-resolution**, and seconds stay in-app (`TimelineView(.periodic)`).

Reload budget is ~40–70/day. The correct pattern is **many pre-computed entries per reload** (Apple
suggests up to 24 h). Entries only need to exist where *non-self-updating* content changes: each
zone's local midnight (Next/Prev Day flips) and DST transitions — roughly 8–30 entries/day.

| Family | Min iOS | Shows |
|---|---|---|
| `systemSmall` | 17 | One city: name, time, zone label, temp, day badge |
| `systemMedium` | 17 | Three cities |
| `systemLarge` | 17 | Six cities, 2×3 |
| `systemExtraLarge` (iPad) | 17 | 8–12 cities |
| `accessoryInline` / `accessoryCircular` / `accessoryRectangular` | 16 | Lock Screen: 1–2 cities |
| StandBy | 17 | `systemSmall` with a clear container background; night tint via rendering mode |
| `ControlWidget` | **18** | Control Center / Action Button: one city's time, or open-at-city |

**Custom-time mode should deliberately not propagate to widgets.** A frozen home-screen clock reads
as a bug, not a feature. The accessory families make watchOS complications near-free later — out of
scope for v1, but the reason to build them properly.

## 8. Shortcuts and App Intents

The part the PRD omits entirely, and the higher-leverage half of the request.

**The keystone: one `CityEntity` serves four surfaces at once** — widget configuration, Shortcuts
parameter pickers, Siri natural-language resolution, and Spotlight. Hosting its `EntityQuery` in a
separate App Intents extension is what lets widget configuration search all 30,481 cities while the
widget process itself stays lean.

| Entity | Backed by |
|---|---|
| `CityEntity` (`EntityStringQuery`) | SQLite FTS5, in the intents extension |
| `BoardSlotEntity` (a city on your board) | `board.json` only — no database |
| `ThemeAppEnum`, `SettingAppEnum` | Settings |

| Intent | Parameters | Returns |
|---|---|---|
| `GetTimeInCity` | city, optional instant | Date + spoken dialog + snippet |
| `ConvertTime` | time, from-city, to-city | Date (chains into other actions) |
| `GetTemperature` | city | `Measurement<UnitTemperature>` |
| `AddCity` / `RemoveCity` | city / board slot | Board slot; throws at the 16 cap |
| `ShareBoard` | cities, include-local | **URL** — the `?z=` link |
| `SetCustomTime` / `ResetTime` | time | — |
| `SetAppearance` / `ToggleSetting` | enum, bool | — |
| `ShowBoard` | optional focus city | Opens the app |
| `RefreshWeather` | — | Widget button; doesn't launch the app |

`AppShortcutsProvider` gives zero-setup Siri phrases (cap 10; use ~4). `ShareBoard` returning a URL
is the one that makes the app composable — it drops straight into a Shortcut that messages the link.
Spotlight should index board cities plus the top few hundred, never all 30,481.

## 9. Phasing and effort

| # | Phase | Days | Needs paid account? |
|---|---|---|---|
| 0 | XcodeGen scaffold, package split, SQLite pipeline, **key golden test**, zone-abbr fixtures | 3–5 | No |
| 1 | Board UI: hero, tiles, search, drag-reorder, settings, 4 themes, fonts | 6–9 | No |
| 2 | Weather, custom-time mode, sharing + Sharing View | 5–7 | Deep links yes; **Universal Links no** |
| 3 | App Group store + widget extension: system, accessory, StandBy | 5–8 | **Likely — see §10** |
| 4 | App Intents extension, entities, intent suite, widget config, Spotlight | 4–6 | No |
| 5 | ClerkKit auth + preferences sync | 4–6 | No |
| 6 | `ControlWidget`, accessibility, polish, TestFlight, submission | 5–8 | **Yes** |

**32–49 focused days — roughly 7–10 weeks.** Something demoable at the end of phase 1 (~2 weeks).

**The external dependency:** Apple **Organization** enrollment `R63L8BG6UB` is *submitted, unpaid,
unverified* (`Code/Shotglass/STATUS.md`), with an unresolved D-U-N-S address risk. Until it
activates, phases 0–2, 4 and 5 can all proceed on the free Personal Team `ZZV3GKQGG9`. If widgets
turn out to be blocked, **run phase 4 before phase 3** — App Intents need no special entitlement.

## 10. Risks and open questions

| Risk | Mitigation |
|---|---|
| **City-key drift** silently breaks share links, saved boards, and D1 rows | Generate keys by importing the real `buildLookup`; SHA-256 golden fixture asserted in both test suites (§5) |
| **Widget OOM** via a transitive link to the city database | Enforce at the SPM product boundary; assert the widget's link map excludes it |
| **Sync corrupts web preferences** — `show_zone_abbr` NULL must read `true` (`preferences.ts:33`), and `theme: "happy"` must round-trip | Non-optional decode defaults; never `PUT` a partial row; contract tests against local `wrangler d1` covering NULL columns and all four themes |
| **Zone-abbreviation parity.** The curated `ZONE_ABBR` table (`city-lookup.ts:154-203`) has **46** entries covering Europe/Asia/Oceania; North America is delegated to `Intl` short names, with anything matching `GMT*`/`UTC*` rejected. Foundation's abbreviations differ from `Intl`'s | Port the table verbatim; golden test over all 356 zones × 4 seasonal dates against a JS-generated fixture |
| **Geolocation UX.** Location permission is an App Store privacy disclosure and a first-run friction point the web app handles with a footer hint | Make it explicitly optional; fall back to `TimeZone.current` (the web falls back to `london_GB`) |

**Open questions — flagged, not answered:**

- **Does a free Personal Team support App Groups?** Sources conflict and I could not settle it. This
  decides whether widget work can start before the org account activates, so it is worth **15 minutes
  of empirical test**: new throwaway project, Personal Team, add the App Groups capability, see
  whether it signs. Do not plan around either answer until then.
- **Analytics.** GA4 + Silktide consent has no clean native equivalent. Drop it, replace it with
  something privacy-preserving, or skip analytics on iOS? Affects the App Privacy questionnaire.
- **Sign in with Apple.** Guideline 4.8 requires offering it once you offer third-party social login.
  Clerk supports it; it needs to be turned on deliberately.
- **Seconds on the hero.** Keep them (a per-second render costs battery) or drop them for parity with
  the widget? A design call.
- **`CITY_NAMES` and share previews.** Already tracked: OG previews resolve only the top 500 cities.
  Unrelated to iOS but shares the same key contract.

## 11. Verification (whenever something is actually built)

- **Key parity is the gate.** The SHA-256 fixture must pass in both JS and Swift before any UI work.
- Zone-abbreviation and relative-offset golden tests against JS-generated fixtures, including
  sub-hour zones (`+5.5HR`, `+10.5HR` — the subject of commit `57a8c7d`).
- Round-trip a `?z=…&t=…` link **web → iOS → web** and confirm identical city sets.
- Sync contract tests against a local `wrangler d1`, explicitly covering a NULL `show_zone_abbr`.
- Widget memory-limit snapshot test; confirm the timeline survives a DST transition in a zone that
  has one.
- Real-device QA — the Simulator does not exercise widget reload budgets or StandBy.

## Sources

Claims here are either read from this repo (cited by `file:line`) or checked against current docs.
**Verified:** Zalando Sans is SIL OFL 1.1; the widget reload budget and the many-entries-per-reload
pattern; Guideline 4.2's treatment of webview wrappers; Xcode 26.3 / iOS 26.2 SDK locally.
**Unverified and flagged as such:** whether a free Personal Team supports App Groups.

- [Zalando Sans — Google Fonts](https://fonts.google.com/specimen/Zalando+Sans) and [zalando/sans](https://github.com/zalando/sans) — OFL 1.1
- [SIL Open Font License](https://openfontlicense.org/)
- [Apple Developer Forums — widget timeline budgets](https://developer.apple.com/forums/thread/667017) and [update frequency](https://developer.apple.com/forums/thread/788820)
- [Get to know App Intents — WWDC25](https://developer.apple.com/videos/play/wwdc2025/244/) and [Explore enhancements to App Intents — WWDC23](https://developer.apple.com/videos/play/wwdc2023/10103/)
- [App Store Review Guidelines 4.2 and webview wrappers](https://www.mobiloud.com/blog/app-store-review-guidelines-webview-wrapper)
- [Apple Developer Program membership](https://developer.apple.com/programs/whats-included/)
