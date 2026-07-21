# 2026-07-21 — "Time Zone Names" toggle (zone abbreviation vs GMT offset)

A new drawer toggle lets each clock tile show its named abbreviation — **EST, PST, CET, JST** — in
place of the `GMT+X` label. Requested by Khoi; **defaults ON for all users**.

## Behavior
- One boolean preference, "Time Zone Names," in the settings drawer (mirrors "Show Relative Time").
- ON → a zone shows its abbreviation **in place of** the GMT label *if a known one exists*; a zone
  with no known abbreviation stays `GMT+X`. So the default board is a **mix** (e.g. `CET · IST ·
  GMT+7`), by design.
- The relative-time pill (`+3HR`) is untouched — separate toggle.

## Why a curated table (the constraint)
The browser's `Intl` API only abbreviates **North-American** zones. Verified: New York→`EDT`,
LA→`PDT`, but Paris→`GMT+2`, Tokyo→`GMT+9`, London→`GMT+1` (not CET/JST/BST). So `Intl` alone can't
produce "CET" — Khoi's own example. Resolution order in `getZoneAbbreviation` (`lib/city-lookup.ts`):
1. **Curated `ZONE_ABBR` table** (~40 IANA zones: Europe CET/CEST, EET/EEST, WET/WEST, GMT/BST, MSK;
   Asia JST/KST/CST/HKT/SGT/ICT/WIB/IST/GST/PKT…; Oceania AEST/AEDT, ACST/ACDT, AWST, NZST/NZDT). US
   zones intentionally omitted — the fallback handles them.
2. **`Intl` "short"** fallback — accepted only if it isn't a `GMT…`/`UTC…` string (catches EST/EDT).
3. **`null`** → caller keeps the GMT label.

**DST is detected from the live offset, never hardcoded:** compare the current offset to the year's
standard (winter) offset, where `stdOffset = min(janOffset, julOffset)` (DST always shifts the clock
forward). This is hemisphere-agnostic — validated in one instant: Paris→CEST while Sydney→AEST.

## Accepted tradeoffs of default-ON
- **Mixed labels** (letters where known, `GMT+X` otherwise).
- **Ambiguous abbreviations now show by default** — `CST` (China *and* US Central), `IST` (India,
  Israel). Emit the most globally-recognized reading per zone. `Asia/Dhaka` omitted so its "BST"
  (Bangladesh) doesn't collide with British Summer Time — it falls back to `GMT+6`.

## Wiring (mirrors `showRelativeTime` end-to-end)
- `lib/city-lookup.ts` — new `getZoneAbbreviation()` + `zoneLabel(city, showZoneAbbr)` helper.
- `pages/world-clock.tsx` — `SHOW_ZONE_ABBR_KEY` state/persist; **default-ON init branches on `null`**
  (`stored === null ? true : stored === "true"`) so a deliberate "false" still opts out; threaded to
  Sidebar, TimeZoneConverter, and both share views.
- `components/sidebar.tsx` — "Time Zone Names" `ToggleSwitch` row.
- `components/time-zone-converter.tsx` — the 3 tile call sites now pass
  `timezone={zoneLabel(city, showZoneAbbr)}` (was `city.gmtLabel`). `digital-clock.tsx` **untouched**
  — it just receives a different label string.
- `components/shared-link-view.tsx` + `shared-link-auth-controller.tsx` — honor it too (like
  `use24Hour`), so a shared link renders the recipient's preference.

## Cloud sync + backend (the deploy-order gotcha)
- `hooks/use-cloud-sync.ts` + `lib/api.ts` — added `showZoneAbbr`; **a missing value resolves to
  `true` everywhere** (`cloud.showZoneAbbr ?? true`, optional wire field), so a legacy record's absent
  field is never read as "off" and pushed back — the field only becomes `false` on an explicit toggle.
- **API (`api/`) is a real SQL-backed Worker, deployed manually — not on push.** Added migration
  `0003_add_show_zone_abbr.sql` (`ALTER TABLE … ADD COLUMN show_zone_abbr INTEGER DEFAULT 1`, i.e.
  ON for existing rows) and threaded the column through `api/src/routes/preferences.ts`
  (row/body/validate/insert/response; validation is lenient — a body omitting the field defaults ON).
- **Deploy sequence matters:** the frontend (Pages) auto-deploys on push and is safe with the *old*
  API (it ignores the extra field; sync keeps working, abbr just reads back default-ON). But the new
  API code references the new column, so **apply the migration BEFORE `wrangler deploy`**:
  ```
  cd api
  npx wrangler d1 execute happyhour-db --remote --file=migrations/0003_add_show_zone_abbr.sql
  npx wrangler deploy
  ```
  Until then the toggle is fully functional client-side (persists in localStorage); only cross-device
  sync of an *off* state waits on the API deploy.

## Verification
- `tsc --noEmit` (client + api) + `build` clean.
- Node spot-check: Paris→CEST, Tokyo→JST, Mumbai→IST, NY→EDT (Intl), São Paulo/Kiritimati/Dhaka→null.
- **74 Playwright tests pass** (72 + 2 new in `tests/zone-abbr.spec.ts`: default-ON shows
  CET/IST/EST; toggling off reverts to `GMT±`). No existing test asserted a GMT label, so default-ON
  broke nothing.
- Skipped the 2-critic design loop (opt-in).

## Follow-ups
- Ship the API migration + worker (above) to sync the off-state across devices.
- Live QA on happyhour.day: the default board reads well as a mix; the drawer toggle flips labels;
  the preference persists across reload.
