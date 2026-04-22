# Happyhour — Product Requirements Document

## Context

Happyhour (formerly Khlock) is a world clock and timezone converter web app (React/TypeScript/Tailwind, deployed on Cloudflare Pages at `happyhour.day`). Phases 1-2 (codebase cleanup, deployment, mobile UX fixes) are complete. The scroll-driven header animation is confirmed smooth. This PRD covers three tracks:

1. **Phase 3: UI Revisions + Cloud Sync** — revise clock tile interactions, hero clock, city menu, drag-and-drop, and add user accounts with cloud-synced preferences
2. **iOS Native App** — SwiftUI app with feature parity + home/lock screen widgets + cloud sync
3. **Sharing** — let users share a selection of clocks (and, when in custom-time mode, a specific moment) via a link that opens a transient view on `happyhour.day`

**Status (2026-03-26):** Most Track 1 UI revisions are complete. Cloud sync (Clerk auth + Cloudflare Worker + D1) shipped 2026-03-25 using the Clerk dev instance (production instance requires a custom domain — see Backlog). Relative time offset feature and AM/PM sizing shipped 2026-03-26. Cross-device sync bug fixed 2026-03-26 — replaced union merge with cloud-wins strategy plus timestamp guard to prevent deleted zones from resurrecting on other devices. App rename voting form created via Google Forms. Several bug fixes and polish items remain before Track 1 is complete.

**Status (2026-04-20):** Full rebrand to Happyhour shipped — new domain `happyhour.day`, favicon, OpenGraph image, header logo, Happy Mode theme (rich yellow), production Clerk instance on `clerk.happyhour.day`. Five UX enhancements + five bug fixes also shipped (scroll-to-current-city on edit, shadcn Dialog for tile removal, removal fade animation, closest-city via browser geolocation, visibility/focus listeners for idle recovery, etc.). See `docs/2026-04-20-devlog.md`.

**Status (2026-04-21):** New outlined wordmark + Happy Mode sidebar icon shipped; Happy Mode promoted to a first-class appearance option alongside light/dark/system. City-loading performance reworked into three tiers (tile cache, top-500 inline bundle, lazy full dataset). Relative-time cloud sync code-complete — awaiting D1 migration + worker deploy. Error-state design specified (this PRD) covering nine failure surfaces; the top three — weather failure, search no-results, empty state — are the first to implement. See `docs/2026-04-21-devlog.md`.

**Status (2026-04-22):** Batch of UX refinements shipped — wordmark color to `#000000` (light/happy), mobile logo vertical alignment, relative-time badge letterspacing, desktop temperature `whitespace-nowrap` fix for wide badges (Sydney +14HR case), duplicate-city edit now flashes the existing tile instead of swapping, mobile drawer-toggle horizontal alignment, sidebar footer "Design Dept Partners LLC" linked to designdept.com, Happy-mode temperature palette revised (four bands), and error states #1/#2/#3/#5/#6/#9 implemented with #4 replaced by a last-tile guard and #8 dropped as unreachable. See `docs/2026-04-22-devlog.md`.

---

## Track 1: UI Revisions + Cloud Sync (Web)

### Goal
Revise the current UI — refine clock tile interactions, simplify the layout to grid-only, improve the Add Cities menu, and update the custom time reset flow. Add user accounts and cloud-synced preferences so clock configurations persist across devices.

### Scope: "Reset Time" Button (replaces "Show Live Time")
**Files:** `client/src/pages/world-clock.tsx`, `client/src/components/digital-clock.tsx`
**Figma:** [Hero Clock component (node 70:1954)](https://www.figma.com/design/ykzuXYZ4gnogbNKZeV3Q1H/Happyhour-Design?node-id=70-1954)

- [x] Remove the blue filled "Show Live Time" button from the sticky header
- [x] Add a "RESET TIME" text link in the hero clock's zone/temp row, right-aligned
  - Style: Inter SemiBold, 14px, uppercase, color `#4e82ee`
  - No icon — text only
  - Padding: 10px horizontal, 7px vertical
  - Visible only when in custom time mode
  - Present in both desktop and mobile hero variants

### Scope: Add Cities Menu Redesign
**Files:** `client/src/components/time-zone-converter.tsx`
**Figma:** [Add Time Zone section (node 36:3207)](https://www.figma.com/design/ykzuXYZ4gnogbNKZeV3Q1H/Happyhour-Design?node-id=36-3207)

- [x] Widen the Add Cities menu to span the full body column width (896px desktop, 327px mobile)
- [ ] Menu overlays clock tiles below (does not push content down) — *currently pushes content down*
- [x] On mobile, position the menu near the top of the viewport so the user can see as much of it as possible
- [x] Keep existing visual style: white background, `#e5e7eb` border, rounded 8px, shadow, search field with magnifying glass icon
- [x] When a searched city is already displayed, highlight it in the results list; tapping scrolls to and highlights the existing tile — *evolved from original "Already displayed" text approach*
- [x] Dark-mode border: `#6C6C6C` on the dropdown container
- [x] **Default view (empty query)** — show a curated top 20 largest cities by metro population, balanced geographically so the list spans Asia, Europe, the Americas, and Africa rather than leaning on any single region. Rendered in the app's existing east-to-west GMT sort. Applies to both the Add Cities dropdown and the per-tile city selector (shared via `searchCities("")` in `client/src/lib/city-lookup.ts`; list defined in `client/src/lib/featured-cities.ts`). *Shipped 2026-04-22.*

  | # | City | Country | GMT | Timezone | Metro pop. |
  |---|---|---|---|---|---|
  | 1 | Tokyo | Japan | GMT+9 | `Asia/Tokyo` | 37M |
  | 2 | Seoul | South Korea | GMT+9 | `Asia/Seoul` | 25M |
  | 3 | Shanghai | China | GMT+8 | `Asia/Shanghai` | 29M |
  | 4 | Beijing | China | GMT+8 | `Asia/Shanghai` | 22M |
  | 5 | Manila | Philippines | GMT+8 | `Asia/Manila` | 14M |
  | 6 | Dhaka | Bangladesh | GMT+6 | `Asia/Dhaka` | 23M |
  | 7 | Delhi | India | GMT+5:30 | `Asia/Kolkata` | 33M |
  | 8 | Mumbai | India | GMT+5:30 | `Asia/Kolkata` | 21M |
  | 9 | Istanbul | Turkey | GMT+3 | `Europe/Istanbul` | 16M |
  | 10 | Moscow | Russia | GMT+3 | `Europe/Moscow` | 12M |
  | 11 | Cairo | Egypt | GMT+2 | `Africa/Cairo` | 22M |
  | 12 | Paris | France | GMT+2 | `Europe/Paris` | 12M |
  | 13 | Kinshasa | DR Congo | GMT+1 | `Africa/Kinshasa` | 16M |
  | 14 | Lagos | Nigeria | GMT+1 | `Africa/Lagos` | 15M |
  | 15 | London | UK | GMT+1 | `Europe/London` | 14M |
  | 16 | São Paulo | Brazil | GMT−3 | `America/Sao_Paulo` | 22M |
  | 17 | Buenos Aires | Argentina | GMT−3 | `America/Argentina/Buenos_Aires` | 15M |
  | 18 | New York | USA | GMT−4 | `America/New_York` | 20M |
  | 19 | Mexico City | Mexico | GMT−6 | `America/Mexico_City` | 22M |
  | 20 | Los Angeles | USA | GMT−7 | `America/Los_Angeles` | 13M |

  GMT offsets above computed 2026-04-22 (DST-active in northern hemisphere; winter values shift London/Paris/NY/LA by −1 hour).

### Scope: Remove List View Toggle
**Files:** `client/src/components/time-zone-converter.tsx`, `client/src/components/digital-clock.tsx`

- [x] Remove the grid/list view toggle buttons entirely
- [x] Remove the `layout` state and all list-view-related code
- [x] Grid view is now the only layout
- [x] Remove `verticalListSortingStrategy` import and usage

### Scope: Remove Meeting Planner Feature
**Files:** `client/src/components/digital-clock.tsx`, `client/src/components/meeting-planner-modal.tsx`, `client/src/components/time-zone-converter.tsx`

- [x] Remove the calendar icon from clock tiles
- [x] Remove the MeetingPlannerModal component and its import
- [x] Delete `client/src/components/meeting-planner-modal.tsx`
- [x] Remove `otherZoneKeys` prop threading from TimeZoneConverter and DigitalClock

### Scope: Next Day / Prev Day Badge
**Files:** `client/src/components/digital-clock.tsx`
**Figma:** [Tile Zone and Temp component (node 27:973)](https://www.figma.com/design/ykzuXYZ4gnogbNKZeV3Q1H/Happyhour-Design?node-id=27-973)

- [x] Add an inline badge next to the GMT offset when the displayed time falls on a different calendar day than the hero clock's time
  - "NEXT DAY" if the tile's date is ahead of the hero's date
  - "PREV DAY" if the tile's date is behind the hero's date
- [x] Badge specs:
  - Border: 1px solid `#6b7280`
  - Border radius: 3px
  - Padding: 5px horizontal
  - Text: Inter Bold, 7px, uppercase, color `#6b7280`
  - Gap between zone row items: 6px (instead of default 10px) when badge is present

### Scope: Drag-and-Drop Revisions
**Files:** `client/src/components/time-zone-converter.tsx`, `client/src/components/digital-clock.tsx`
**Figma:** [Desktop Drag Tile frame (node 4:2)](https://www.figma.com/design/ykzuXYZ4gnogbNKZeV3Q1H/Happyhour-Design?node-id=4-2), [Clock Tile states (node 17:2410)](https://www.figma.com/design/ykzuXYZ4gnogbNKZeV3Q1H/Happyhour-Design?node-id=17-2410)

- [x] Blue drop indicator always appears to the LEFT of the destination spot
  - Width: 4px, color: `#3c83f6`, border radius: 4px, full height of tile
- [x] Ghost tile (source position while dragging): 50% opacity
- [x] Drag overlay (tile following cursor): 90% opacity, yellow active background (`#fdf19d`), border 1px solid `#ffedbd`, shadow `0px 1px 2px rgba(0,0,0,0.15)`
- [x] Long-press to initiate drag on tile body (600ms delay, 5px movement tolerance); drag handle icon uses faster 150ms delay
- [ ] **Bug:** Touch drag unreliable on left-most column — pressing/holding sometimes doesn't trigger drag, or requires unnaturally long hold
- [ ] **Bug:** Drag overlay vertical spacing differs from resting tile — dragged tile should maintain identical sizing across all states

### Scope: Ellipsis Menu Replaces X Button
**Files:** `client/src/components/digital-clock.tsx`

- [x] Replace the X (close) button in each clock tile with an ellipsis icon enclosed in a circle (~17px)
- [x] Clicking/tapping the ellipsis opens a native browser `confirm()` dialog asking the user to confirm removal
- [x] If confirmed, remove the clock tile; if cancelled, do nothing

### Scope: Clock Tile Design Refinements
**Files:** `client/src/components/digital-clock.tsx`, `client/src/index.css`
**Figma:** [Clock Tile states (node 17:2410)](https://www.figma.com/design/ykzuXYZ4gnogbNKZeV3Q1H/Happyhour-Design?node-id=17-2410)

- [x] Tile states from Figma:
  - **Default:** white background
  - **Hover:** `#f0f0f0` background (desktop only, `@media(hover:hover)`)
  - **Focus (editing/dropdown open):** `#fdf7ca` background, 1px `#ffedbd` border
  - **Active (being dragged):** `#fdf19d` background, 1px `#ffedbd` border, shadow `0px 1px 2px rgba(0,0,0,0.15)`
- [x] Desktop tile layout: city name and time stacked vertically, 15px gap between city+time block and zone+temp row
- [x] Mobile tile layout: city name and time side-by-side (horizontal), 0px gap to zone+temp
- [x] Clock tile editing: single `type="time"` input with bordered edit UI matching Figma specs
- [x] Duplicate city guard *(revised 2026-04-22)*: when the user picks an already-displayed city in a tile's edit menu, the editing tile is left unchanged and the existing tile flashes yellow (`animate-highlight-yellow`, ~1.5s). Previously swapped positions — swap triggered a stale-editing-state bug on the other tile
- [x] Last-tile guard *(added 2026-04-22)*: the ellipsis menu is hidden when only one tile remains; `handleRemoveClock` no-ops when the grid has a single zone
- [x] Max clocks: 16 (web)
- [x] **Temperature color bands** *(added 2026-04-22, see `docs/2026-04-22-temperature-colors.md`)*: `getTemperatureColor` in `client/src/hooks/use-weather.ts` maps °C to Tailwind classes; `.happy` overrides in `client/src/index.css` shift four bands for contrast against the `#FFD900` page.

  | Band     | Range (°C) | Tailwind class       | Light / Dark | Happy       |
  |----------|------------|----------------------|--------------|-------------|
  | Freezing | ≤ 0        | `text-blue-500`      | `#3b82f6`    | `#3b82f6`   |
  | Cold     | 1–10       | `text-cyan-500`      | `#06b6d4`    | `#06b6d4`   |
  | Mild     | 11–18      | `text-green-500`     | `#22c55e`    | `#10b981` (emerald-500) |
  | Warm     | 19–24      | `text-yellow-500`    | `#eab308`    | `#C68A1A`   |
  | Hot      | 25–30      | `text-orange-500`    | `#f97316`    | `#CA6100`   |
  | Very hot | > 30       | `text-red-500`       | `#ef4444`    | `#B51818`   |

- [ ] **Bug:** "New Delhi" city name wrapping again — let city name span full tile width (flow under time display) before truncating; maintain left alignment of city name, timezone, and temp rows (must not shift under drag handle icon)

### Scope: Sidebar Menu *(added post-PRD, implemented 2026-03-21)*
**Files:** `client/src/components/sidebar.tsx`, `client/src/pages/world-clock.tsx`
**Figma:** [Sidebar section (node 114:1302)](https://www.figma.com/design/ykzuXYZ4gnogbNKZeV3Q1H/Happyhour-Design?node-id=114-1302)

- [x] Sidebar slides in from the right, overlays the body
- [x] Contains: 24-hour clock toggle, east-to-west sort toggle, relative-time toggle, appearance mode (light/dark/system/happy)
- [x] Full viewport height with ~28px padding top and bottom
- [x] Full viewport width on mobile
- [x] Smooth expand/collapse animation; no animation on initial page load
- [x] Drawer icon position stays consistent between open/closed states
- [x] Body scroll locked when sidebar is open
- [x] Account/login UI designed but intentionally non-functional (deferred to cloud sync phase)
- [x] Copyright footer "©2026 Design Dept Partners LLC" pinned to bottom of the sidebar panel via `mt-auto` ([Figma 114:1557](https://www.figma.com/design/ykzuXYZ4gnogbNKZeV3Q1H/Happyhour-Design?node-id=114-1557))
- [ ] **Bug:** Login button text vertical alignment — text is 1-2px too close to the top
- [ ] Reduce sidebar height on mobile by ~20% — currently extends below fold when browser address bar is fully shown

### Scope: Cloud Sync & User Accounts *(shipped 2026-03-25)*
**Auth:** Clerk (Google + Apple social login via dev instance)
**Backend:** Cloudflare Workers + D1

- [x] Clerk modal login flow (Google + Apple)
- [x] Cloudflare Worker API: `GET/PUT /api/preferences`, `DELETE /api/account`
- [x] D1 schema: `user_preferences` table (user_id, zones, use_24h, sort_etw, theme, show_rel_time, updated_at) — `show_rel_time` added 2026-04-21 via migration 0002
- [x] `useCloudSync` hook: fetch on sign-in, debounce-save on change
- [x] Cross-device sync: cloud-wins strategy with timestamp guard (replaced union merge that resurrected deleted zones)
- [x] Sidebar: user avatar + name when signed in, sign out button, sync status indicator
- [x] Graceful fallback: unauthenticated users use localStorage only

### Scope: User Name Display Redesign
**Files:** `client/src/components/sidebar.tsx`
**Figma:** [Sidebar user display (node 114:1557)](https://www.figma.com/design/ykzuXYZ4gnogbNKZeV3Q1H/Happyhour-Design?node-id=114-1557)

- [ ] Update signed-in user display in sidebar to match Figma component

### Scope: Relative Time Offset
**Files:** `client/src/components/digital-clock.tsx`, `client/src/components/sidebar.tsx`, `client/src/pages/world-clock.tsx`
**Figma:** [Tile with relative time (node 158:1840)](https://www.figma.com/design/ykzuXYZ4gnogbNKZeV3Q1H/Happyhour-Design?node-id=158-1840)

- [x] Add "Show Relative Time" toggle in sidebar (default OFF), synced to cloud
- [x] When enabled, display offset relative to hero zone in format "+1HR" or "-7HR" in the zone/temp row
- [x] Offset rendered inside a bordered badge; when combined with NEXT/PREV DAY, merged into a single unified badge with vertical divider (e.g. `+13HR | NEXT DAY`) — fixes wrapping bug on mobile
- [x] AM/PM meridiem indicators rendered at reduced font size for readability (hero: 36/48px, tiles: 16/24px)

### Scope: Header Wordmark + Happy Mode Theme *(shipped 2026-04-21)*
**Files:** `client/src/components/icons/happyhour-wordmark.tsx`, `client/src/components/icons/happyhour-logo.tsx`, `client/src/components/icons/happy-mode-icon.tsx`, `client/src/pages/world-clock.tsx`, `client/src/components/sidebar.tsx`, `client/src/index.css`
**Figma:** [Header wordmark (70:2208)](https://www.figma.com/design/ykzuXYZ4gnogbNKZeV3Q1H/Happyhour-Design?node-id=70-2208), [Dark-mode header (114:1333)](https://www.figma.com/design/ykzuXYZ4gnogbNKZeV3Q1H/Happyhour-Design?node-id=114-1333), [Happy Mode sidebar (198:1789)](https://www.figma.com/design/ykzuXYZ4gnogbNKZeV3Q1H/Happyhour-Design?node-id=198-1789), [Mobile header (6:2)](https://www.figma.com/design/ykzuXYZ4gnogbNKZeV3Q1H/Happyhour-Design?node-id=6-2)

- [x] New outlined wordmark SVG (`HappyhourWordmark`) with fills bound to `currentColor`; logo fixed to 38 px, gap to 10 px. Wordmark color: light + happy = `#000000` *(revised 2026-04-22 from `#333333`)*, dark = `#FFFFFF`. On mobile `<500 px`, the logo gets a `mt-[2px]` offset so its top edge aligns with the "H" cap
- [x] Scroll animation interpolates logo + wordmark heights (replaces the prior h1 font-size approach)
- [x] Mobile (<500 px) scales the wordmark to 73 % per the Figma mobile variant
- [x] Happy Mode promoted to a first-class theme option — `system → light → dark → happy` cycle in the Appearance control
- [x] Happy Mode palette: rich yellow (`#FFD900` accent), yellow smiley logo variant, dedicated stroked-smile sidebar icon (`HappyModeIcon`)
- [x] Happyhour logo canonicalized to yellow circle + black face; `default` and prior `dark` variants collapsed (both render identically) — `happy` variant remains distinct
- [x] `.happy`-scoped overrides in `index.css` ensure temperature text stays legible against the yellow background

### Scope: City-Loading Performance Tiers *(shipped 2026-04-21)*
**Files:** `client/src/lib/city-lookup.ts`, `client/src/lib/tile-cache.ts`, `client/src/data/cities-top.json`, `scripts/build-top-cities.mjs`, `client/src/components/time-zone-converter.tsx`, `package.json`

- [x] **Tier 1 — tile cache** (`tile-cache.ts`): persists full `TimezoneOption` metadata per selected zone in `localStorage["happyhour:tile-cache"]`; returning users render tiles synchronously on first paint even for cities outside the top-500
- [x] **Tier 2 — top-500 inline bundle** (`cities-top.json`, 38.97 KB / 16.63 KB gzip): statically imported via `loadTopCities()`; search dropdown responsive from keystroke 1
- [x] **Tier 3 — lazy full dataset** (`cities-*.js`, 2.05 MB lazy chunk): loads on `requestIdleCallback` (3 s timeout) OR first open of the Add Time Zone dropdown; `loadCities()` is idempotent
- [x] Public helper `getCityOrCachedTile(key)` falls through tier 2 → tier 3 → tier 1 cache
- [x] New npm script `build:top-cities` — re-run when `cities.json` is regenerated from GeoNames

### Out of Scope (Phase 3)
- Theme/color palette changes (current palette is close to final)

### Scope: Error States *(design 2026-04-21, implementation 2026-04-22)*

Inventory of failure surfaces in the app and where each appears in the UI. Recommendations favor inline, contextual surfaces (tile, dropdown, hero) over modal/banner interrupts — matching Happyhour's minimal aesthetic. Source audit: `docs/2026-04-21-devlog.md` → "Error-state design audit". 2026-04-22 revisions: #4 (empty state) dropped in favor of a last-tile guard; #7 (sync failure) kept as-is with no extra retry UI; #8 (invalid time input) dropped as unreachable; #1/#2/#3/#5/#9 designs refined per Figma 232-3160 / 232-3310 / 232-3323 / 232-3671 / 232-3847.

| # | Error | UI surface — where it appears | Copy | Status |
|---|---|---|---|---|
| 1 | Weather fetch fails | **Inline in the zone/temp row** (tiles + hero), replacing the temperature. No icon or tooltip — just the text badge. Triggered when the `useWeather` query is in `isError` state. | `Weather Unavailable` — Inter SemiBold 8px uppercase `#6b7280`, `tracking-[0.2px]` | **Shipped 2026-04-22** |
| 2 | City search: no results | **Inside the Add Cities dropdown** and the per-tile city selector — replace the current `CommandEmpty` text. Single line, muted. | `Can’t find “{query}”` | **Shipped 2026-04-22** |
| 3 | Offline / no network | **Global banner slot** directly below the sticky header. Full-width, rounded 5px, `p-[10px]`, theme-aware colors (see below). Driven by `navigator.onLine` + `online`/`offline` window events via `useOnlineStatus`. `role="status" aria-live="polite"`. Auto-hides on reconnect. | Desktop: **`You're Currently Offline`** (bold) + `Weather and sync will resume when you're back online.` Mobile: only the bold headline | **Shipped 2026-04-22** |
| 4 | ~~Empty state (no cities)~~ | **Replaced with a last-tile guard** (see Clock Tile Design Refinements). `handleRemoveClock` no-ops when only one zone remains; the ellipsis button is hidden on the last tile. | — | **Shipped 2026-04-22** |
| 5 | Geolocation denied | **Inline trailing text next to the hero city name.** Renders when `resolveLocalCity()` resolves with `geoDenied: true` (PositionError.PERMISSION_DENIED). No dismiss `×` — hint stays until the permission state changes (matches Figma 232-3671). | `Allow location for a closer match.` — 10px, non-uppercase, `#6b7280`, appended after the city name with `ml-2` | **Shipped 2026-04-22** |
| 6 | Full city DB fails to load | **Footer of the Add Cities dropdown**. Renders when `didFullCitiesFail()` returns true (the `loadCities()` import rejected). | `Showing top 500 cities — full list unavailable.` — 11px muted, `border-t` on container | **Shipped 2026-04-22** |
| 7 | Cloud sync failure | **Existing `SyncStatusIndicator` in the sidebar** — no additional UI. Current "Sync error" state with `AlertCircle` icon is the final treatment. No separate retry button; sync retries on the next debounced change. | Sidebar indicator only | **Final (no change)** |
| 8 | ~~Invalid time input~~ | **Dropped.** Investigation 2026-04-22 confirmed the native `<input type="time">` prevents empty/malformed submissions from reaching `handleUpdateClick`, which also has an `if (editTime)` guard. No observable error state. | — | **N/A** |
| 9 | 404 / unknown route | **`client/src/pages/not-found.tsx` rebuilt** per Figma 232-3847: hero-style layout with "ERROR" eyebrow, huge "404" heading (Zalando Sans Black 96px), and a red `#ef4444` body line. Header renders the Happyhour logo + wordmark linked to `/` (no separate CTA button needed). | Eyebrow: `ERROR` · Heading: `404` · Body: `Sorry, couldn't find your page.` | **Shipped 2026-04-22** |

**Offline banner theme colors:**

| Mode | Background | Text |
|---|---|---|
| Light | `#fdf7ca` | `#6b7280` |
| Dark  | `#3d3520` | `#e5e5e5` |
| Happy | `#333333` | `#FFD900` |

#### Shipping order (historical, for reference)

Shipped in one batch on 2026-04-22: #1, #2, #3, #4→guard, #5, #6, #9. #7 needed no change. #8 dropped.

---

## Track 2: iOS Native App

### Goal
Build a native SwiftUI iOS app with full feature parity to the web app, plus home screen and Lock Screen widgets. Share user accounts and synced preferences with the web app.

### Core Features (Parity with Web)

1. **World Clock Display**
   - Hero clock showing local timezone with large digital time
   - Additional clocks grid (reorderable, grid layout only)
   - Live time with seconds display
   - Custom time mode (tap to edit, "Reset Time" text link to return to live)

2. **City Management**
   - Search and add cities (same 1500-city dataset from city-timezones)
   - Full-width search menu with "Already displayed" status for duplicate cities
   - Remove cities (ellipsis menu → confirmation)
   - Drag-to-reorder with left-side drop indicator
   - Max 16 clocks (matching web)
   - Cloud sync of city list and order via Clerk account (cross-platform with web)

3. **Weather Integration**
   - Temperature display per city via Open-Meteo API (free, no auth)
   - Color-coded temperature

4. **Day Indicator**
   - "Next Day" / "Prev Day" badge on tiles where displayed time is a different calendar day

5. **Appearance**
   - Light/dark/system theme support
   - Minimal, clean design matching web app aesthetic
   - Smooth animations and transitions

### iOS-Specific Features

6. **Home Screen Widgets**
   - Small widget: single city clock + weather
   - Medium widget: 2-3 city clocks
   - Large widget: up to 6 city clocks
   - Configurable city selection per widget

7. **Lock Screen Widgets**
   - Inline widget: single city time
   - Circular widget: city abbreviation + time
   - Rectangular widget: city + time + weather

### Technical Architecture

- **Language:** Swift 6
- **UI Framework:** SwiftUI
- **Minimum iOS:** 17.0 (for latest widget APIs)
- **Data Persistence:** SwiftData or UserDefaults + App Groups (for widget data sharing)
- **Networking:** URLSession + async/await for Open-Meteo API and sync API
- **City Database:** Bundle the city-timezones dataset as JSON, load at launch
- **Widget Framework:** WidgetKit with TimelineProvider
- **Cloud Sync:** Clerk iOS SDK for auth + Cloudflare Workers API (shared with web)

### Project Structure (Proposed)
```
Happyhour/
├── HappyhourApp/
│   ├── App/                       # App entry, navigation
│   ├── Models/                    # City, Clock, Weather models
│   ├── Views/
│   │   ├── WorldClockView         # Main screen
│   │   ├── ClockTileView          # Individual clock tile
│   │   ├── HeroClockView          # Large hero clock
│   │   └── CitySearchView         # City search/add
│   ├── ViewModels/                # ObservableObject view models
│   ├── Services/
│   │   ├── WeatherService         # Open-Meteo API client
│   │   ├── SyncService            # Cloudflare Workers API client for preference sync
│   │   └── CityDatabase           # City lookup & search
│   └── Resources/
│       └── cities.json            # Bundled city database
├── HappyhourWidgets/
│   ├── HappyhourWidgets.swift     # Widget bundle
│   ├── HomeScreenWidget.swift     # Small/Medium/Large
│   └── LockScreenWidget.swift     # Inline/Circular/Rectangular
└── Shared/
    └── Models/                 # Shared between app & widgets
```

### Phased Delivery (iOS)
1. **MVP:** World clock display, city search, add/remove, drag-to-reorder
2. **V1.0:** Weather integration, day indicator badges, custom time mode, theme support, cloud sync
3. **V1.1:** Home screen & Lock Screen widgets

---

## Track 3: Sharing

### Goal
Let any user generate a link that shares a subset of their clocks — and, when the sender is in custom-time mode, the specific moment they're viewing. Opening the link loads those clocks into a transient Happyhour session on `happyhour.day` that does not overwrite the recipient's saved state. A prominent CTA lets the recipient save the shared cities to their own Happyhour (and, once it exists, download the iOS app).

### Sender flow

1. **Entry** — Sidebar menu gets a new `Share` item (below Appearance, above the auth block).
2. **Share mode** — Tapping `Share` closes the sidebar and puts the main view into share-mode. Every clock (hero + tiles) shows a round checkbox in a corner. The hero tile is pre-selected by default; all others start deselected. Non-selected tiles dim to ~40 % opacity. A dismissible `Cancel` affordance sits next to the existing "RESET TIME" slot.
3. **Selection** — User taps tiles to toggle inclusion. Minimum selection: 1 (the hero pre-selection satisfies this).
4. **Confirmation** — A bottom sheet (desktop: dialog) opens with:
   - Preview: a compact list of selected cities and, if moment is attached, the frozen time
   - `Copy link` button (primary)
   - `Share…` button invoking `navigator.share()` where supported (iOS Safari, Chrome Android)
   - Email fallback (mailto with pre-filled subject/body)
5. **Moment handling** — If the sender is in **live** mode, the link encodes zones only. If in **custom-time** mode, the link encodes zones + the current hero moment as an ISO 8601 timestamp. No extra toggle in the share UI — the current app mode determines the share mode.
6. **Exit** — Copying the link, triggering `navigator.share`, pressing Escape, or tapping `Cancel` exits share mode.

### Share URL structure

Client-encoded, stateless. No backend in v1.

| Param | Purpose | Example |
|---|---|---|
| path | `/s` | `happyhour.day/s` |
| `z` | Comma-separated city keys, hero first | `z=paris_FR,newYork_US,tokyo_JP` |
| `t` | Optional ISO 8601 instant (with offset) — presence indicates frozen-moment share | `t=2026-04-21T15%3A00%3A00-04%3A00` |

Example (live): `https://happyhour.day/s?z=paris_FR,newYork_US`
Example (custom-time meeting share): `https://happyhour.day/s?z=paris_FR,newYork_US&t=2026-04-21T15%3A00%3A00-04%3A00`

**Decoding** — `/s` route reads params, resolves zones via the existing tier lookups (`getCityOrCachedTile`, `loadTopCities`, `loadCities`), sets the first zone as hero, and if `t` is present flips into custom-time mode with that instant. Invalid or missing city keys are skipped with a small inline note ("3 of 4 cities loaded"); an empty set falls back to the sender's implied hero and shows a "Link looks broken" state.

### Recipient view

- **Route** — `/s?z=…&t=…` is a distinct route from `/`; its state is session-scoped, never written to localStorage, never sent to the cloud-sync API.
- **Interactivity** — Full app: recipient can toggle 24h, change time, toggle relative-time, drag to reorder, add/remove cities. These edits live only in the current tab session. Refreshing the share URL re-loads the shared state; closing the tab discards the session.
- **Recipient's saved state is preserved** — their `localStorage["happyhour:zones"]` and cloud-synced zones are untouched. Leaving the `/s` route returns them to their own view.
- **Save CTA** — A dismissible banner below the sticky header reads:
  > `Save these cities to your Happyhour` · `[Save]` · `[×]`

  Tapping `Save` merges the shared zones into the recipient's saved set, respecting the 16-city cap. If the merge would exceed 16, the banner switches to a choice: `Replace your cities / Add as many as fit / Cancel`. Dismissing the banner persists that dismissal for the current tab session only — it returns on future share visits.
- **Sign-in prompt** — unchanged from the main app (sidebar `Sign in` button). Signing in while on `/s` applies the same Save CTA logic on top of the cloud-synced set.
- **iOS app download** — sidebar gets a `Get the iOS app` link under the Share item once Track 2 ships. On first arrival at `/s` from a mobile user agent, a one-time subtle toast also surfaces the download link; dismissal persists in `localStorage["happyhour:ios-cta-dismissed"]`.

### Open Graph / social previews

- **v1:** static OG image and metadata. `og:title` reads `Happyhour — shared clocks`; `og:description` lists up to 3 city names from `?z=`. Handled at build time by index.html + a tiny runtime patch via `document.querySelector('meta[property="og:description"]')` on `/s` routes. This is a no-cost first pass.
- **Later:** dynamic OG image rendered by a Cloudflare Worker route (Satori or equivalent) showing the selected city names + times. Deferred — track as a Backlog item.

### Selection UX specifics

| Element | Spec |
|---|---|
| Checkbox position | Top-right corner of each tile, 12 px inset. Hero gets a matching checkbox in its existing zone/temp row |
| Checkbox state | Unselected: 1 px `#6b7280` stroke, transparent fill. Selected: yellow fill (`#FFD900`), black check glyph |
| Dimmed tile | Opacity 0.4; pointer-events pass through to the checkbox only |
| Keyboard | `Space` toggles a focused tile; `Esc` exits share mode; `Enter` on the confirmation modal copies link |
| Share button state | Disabled (40 % opacity, `aria-disabled="true"`) when zero tiles selected |

### Technical scope

| Area | Change |
|---|---|
| Routing | `App.tsx` gets a new route `/s` pointing to a new `client/src/pages/share.tsx`. The share page renders the same `WorldClock` tree, with a `transient` prop that suppresses localStorage writes and cloud-sync calls |
| URL helpers | New `client/src/lib/share-url.ts` exposing `encodeShareUrl({ zones, heroKey, frozenInstant? })` and `decodeShareUrl(search: string)` |
| Share mode state | Lifted into `world-clock.tsx` alongside existing hero/zones state; threaded down as a `shareMode` prop to tiles |
| Share mode overlay | New `client/src/components/share-mode-overlay.tsx` — Cancel affordance, confirmation modal, copy/share/email buttons |
| Sidebar | Add `Share` menu item above the auth block |
| Tile | `digital-clock.tsx` renders a checkbox when `shareMode === true`; dims when unselected |
| Transient-mode plumbing | `useCloudSync` and the localStorage-writing code paths in `world-clock.tsx` and `time-zone-converter.tsx` short-circuit when a top-level `transient` flag is set |
| No backend | v1 is purely client-side. No D1 schema change, no new API endpoint |

### Out of scope (Track 3 v1)

- Server-generated short IDs (deferred — Backlog)
- Dynamic OG images (deferred — Backlog)
- Share analytics / open counts (deferred — requires backend)
- Expiring share links (requires backend)
- Embeds / iframes

### Phased delivery (Sharing)

1. **v1.0** — Share mode + copy-link + transient view + Save CTA (live-mode shares only)
2. **v1.1** — Frozen-moment shares via `?t=` (requires custom-time plumbing already in the app)
3. **v1.2** — iOS deep-link (after Track 2 ships) — `happyhour.day/s` URLs open the iOS app if installed, fall through to web if not
4. **v2.0** — Dynamic OG images + optional short IDs (if usage justifies a backend)

---

## Verification

### Web (Track 1)
- Visual inspection on Chrome mobile emulator (390x844 iPhone 14)
- Test both light and dark modes
- Verify grid layout at 375px, 768px, 1024px, 1440px
- Confirm drag-to-reorder: drop indicator always on LEFT, correct opacity for ghost (50%) and overlay (90%)
- Verify long-press drag works on tile body (600ms) and drag handle (150ms)
- Verify "Reset Time" text link appears in hero zone/temp row in custom time mode and resets correctly
- Verify Add Cities menu spans full body width, positions near top on mobile
- Verify already-displayed cities are highlighted in search results, tapping scrolls to tile
- Verify Next Day / Prev Day badges appear for clocks on different calendar days
- Verify ellipsis icon opens native confirm dialog and removes tile on confirmation
- Verify sidebar: opens/closes smoothly, toggles work, body scroll locked when open
- Verify duplicate city change swaps tiles instead of crashing
- Deploy to https://happyhour.day/ and test on real device

### iOS (Track 2)
- Run in Xcode Simulator (iPhone 15 Pro, iPhone SE)
- Test widget rendering in widget gallery
- Verify Open-Meteo API calls work on device
- Test drag-to-reorder with haptic feedback
- Test light/dark mode transitions
- Sign in with same account as web, verify same cities appear
- Test offline behavior (local changes sync when back online)

### Sharing (Track 3)
- Enter share mode from the sidebar; confirm hero is pre-selected and other tiles start unselected
- Toggle tiles, verify dim/full-opacity transitions and checkbox states
- Copy a live-mode link, open in a private/incognito window: confirm shared zones load and the recipient's (empty) localStorage stays empty
- Open the same link in a window that already has saved zones: confirm saved zones are preserved, Save CTA banner appears
- Test the Save CTA with an under-16 merge (succeeds silently) and an over-16 merge (shows Replace/Add-as-fit/Cancel choice)
- In custom-time mode, generate a share link, open in incognito: confirm recipient lands in custom-time mode at the same instant
- In custom-time mode recipient view, edit time: confirm the change is session-only (refresh returns to the shared instant)
- Test on mobile Safari and Chrome Android: `navigator.share` fires native sheet; fallback to `Copy` works when unsupported
- Test with an invalid city key in `?z=`: confirm graceful skip + "N of M loaded" note
- Test OG preview by pasting the share URL into Slack / iMessage / Discord

---

## Recommended Next Steps

### Batch A — Quick fixes
1. Login button text vertical alignment (1-2px CSS tweak)
2. New Delhi city name wrapping (span full tile width, maintain left alignment)
3. Sidebar mobile height (reduce ~20%)

### Batch B — Drag fixes
4. Drag overlay vertical spacing mismatch (match resting tile sizing)
5. Touch drag unreliable on left column (sensor tuning)

### Batch C — UI enhancements
6. Add Cities menu overlay (float over tiles, not push down)
7. User name display redesign (Figma node 114:1557)

### Then:
8. Begin Track 2 (iOS native app), using the finalized web app as the reference design

---

## App Rename

### Status
**Completed 2026-04-20** — renamed to **Happyhour**, live at `https://happyhour.day`. The voting poll below captures the pre-rename deliberation; see `docs/2026-04-20-devlog.md` and the related edit-spec for the execution narrative.

### Candidates (voting shortlist, historical)

| # | Name | Notes |
|---|------|-------|
| 1 | **Goldenhour** | Evocative, warm. |
| 2 | **Tymely** | Readable misspelling, very ownable. |
| 3 | **Khlock** | Previous name. Personal, punny. |
| 4 | **Hi Time** | Friendlier, greeting-like. Two words. |

**Voting form:** [Google Form](https://docs.google.com/forms/d/e/1FAIpQLSeFXrJK7ZmhkvJWb3JVxmoJP2Y5ZYrOqgwrDzH5VlxiLcvmFQ/viewform) — rated each name 1-5. Poll results captured in `docs/2026-03-27-naming-poll-results.md`.

### Eliminated candidates
- Goldnhour, Timly, Hightime — removed from shortlist 2026-03-26

### Changes Required (completed 2026-04-20)

- [x] Register domain — `happyhour.day` on Namecheap
- [ ] Rename GitHub repository — *pending (Phase B.1)*
- [x] Update `package.json` name field
- [x] Update heading text in `client/src/components/` (header renders brand wordmark + smiley logo)
- [x] Update Clerk app (production instance on `clerk.happyhour.day`)
- [ ] Rename Cloudflare Pages project — *not supported in-place; left as `khlock` since it's internal-only now*
- [x] Custom domain on Pages (`happyhour.day` + `www.happyhour.day` redirect)
- [x] Update Worker CORS allowed origins (`happyhour.day` added; `khlock.pages.dev` retained as transitional fallback)
- [x] Update `<title>` and meta tags in `index.html`
- [x] Open Graph / social preview metadata (new `og.png`, favicon, og:* + twitter:* tags)
- [ ] Update iOS app target name and bundle identifier (Track 2) — *deferred; iOS app not yet started*
- [x] Update all docs (PRD, CLAUDE.md, devlogs) to use new name

---

## Backlog

- [ ] Keyboard shortcuts — add clock tiles, tab between clocks, edit custom time, etc.
- [ ] Increase zone/temp font size on clock tiles for better readability
- [ ] Sharing: dynamic OG images — Worker-rendered preview showing selected cities + times (v2.0 of Track 3)
- [ ] Sharing: server-generated short IDs with optional expiry (v2.0 of Track 3; requires new D1 table + API endpoints)

---

## Appendix A: How the Database Works

Happyhour stores user settings (which cities are added, 24h mode, theme, etc.) in two places that work together.

### The Two-Layer System

| Layer | Technology | Where it lives | Who can access it |
|-------|-----------|----------------|-------------------|
| **Local storage** | Browser localStorage | On the user's device, managed by the browser | Only that user, on that specific browser |
| **Cloud database** | Cloudflare D1 (SQLite on Cloudflare Workers) | On Cloudflare's servers | Only that user, after signing in |

### Local Storage (the default)

Every time a user adds a city, toggles 24h mode, or changes the theme, the app saves that immediately to the browser's local storage. This is what makes the app work without an account — no sign-in needed, no network required.

**Storage keys** (all prefixed `world-happyhour-`):

| Key | What it stores |
|-----|---------------|
| `zones` | JSON array of city keys (e.g. `["paris_FR", "newYork_US"]`) |
| `24h` | Whether 24-hour mode is on |
| `sort-etw` | Whether east-to-west sorting is on |
| `theme` | `"light"`, `"dark"`, `"system"`, or `"happy"` |
| `rel-time` | Whether relative time offset badges are shown |
| `sync-snapshot` | Fingerprint of last synced state (for change detection) |
| `sync-at` | Timestamp of last successful cloud sync |

**Limitations:**
- Tied to one browser on one device — opening Happyhour on another device won't have these cities
- Cleared if the user clears browser data
- No backup or history

### Cloud Database (when signed in)

When the user signs in via Clerk, the app also syncs preferences to a Cloudflare D1 database. The entire cloud schema is a single table with one row per user:

```sql
CREATE TABLE user_preferences (
  user_id       TEXT PRIMARY KEY,
  zones         TEXT NOT NULL,       -- JSON array of city keys
  use_24h       INTEGER DEFAULT 0,   -- 0 = off, 1 = on
  sort_etw      INTEGER DEFAULT 0,   -- 0 = off, 1 = on
  theme         TEXT DEFAULT 'system',
  show_rel_time INTEGER DEFAULT 0,   -- 0 = off, 1 = on (added 2026-04-21 via migration 0002)
  updated_at    TEXT NOT NULL        -- ISO 8601 timestamp
);
```

**API endpoints** (Cloudflare Worker at `/api/`):

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/preferences` | Fetch user's cloud preferences |
| `PUT` | `/api/preferences` | Save/update preferences (upsert) |
| `DELETE` | `/api/account` | Delete all user data |

All endpoints require a Clerk JWT bearer token. The Worker validates tokens against Clerk's JWKS endpoint.

### How Sync Works

The app uses a **local-first** approach:

1. **Every change saves to localStorage immediately** — the UI never waits for the cloud
2. **If signed in**, changes are also pushed to the cloud after a 1.5-second debounce (so rapid clicks don't flood the server)
3. **On sign-in from a new device**, cloud data is pulled and applied
4. **Conflict resolution:** timestamp-based, last-write-wins — if changes were made on two devices while offline, the most recent `updated_at` wins (no field-level merging)

The sync hook (`useCloudSync`) tracks state via the `sync-snapshot` fingerprint. When the fingerprint of current preferences differs from the stored snapshot, the hook knows local changes have occurred since the last sync.

### Limitations

| Limitation | Detail |
|-----------|--------|
| Max 16 cities | Enforced by both client and API |
| No history or undo | Only the latest state is stored |
| Last-write-wins | Conflicting edits from two devices resolve by timestamp, not merge |
| Single table | Cloud DB stores preferences only — no analytics or usage data |
| Clerk dependency | Cloud sync requires Clerk auth service to be configured |
