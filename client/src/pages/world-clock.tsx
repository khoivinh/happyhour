import { useState, useEffect, useCallback } from "react";
import { TimeZoneConverter } from "@/components/time-zone-converter";
import { Sidebar, DrawerToggleIcon } from "@/components/sidebar";
import { getCityByKey } from "@/lib/city-lookup";
import { useCloudSync } from "@/hooks/use-cloud-sync";
import { useTheme } from "@/lib/theme-provider";
import { initZonesFromStorage } from "@/components/time-zone-converter";
import { HappyhourLogo } from "@/components/icons/happyhour-logo";
import { HappyhourWordmark } from "@/components/icons/happyhour-wordmark";
import { OfflineBanner } from "@/components/offline-banner";
import { SiteFooter } from "@/components/site-footer";
import { track } from "@/lib/analytics";

// px of scroll over which the hero shrink fully plays out. The logo bar is ~75px tall, so
// the hero has locked to the top of the viewport before the shrink completes.
// MUST stay in sync with the +120px scroll runway in <main>'s min-height below — that runway
// is what guarantees this range is always reachable.
const SCROLL_RANGE = 120;

// The drawer toggle is pinned: it must not move by a single pixel at any scroll offset.
// 22px aligns the top of its icon with the top of the city name's glyphs once the hero is
// sticky (measured: city ink top = 22.28px), and — because the logo bar's pt-[13px] plus the
// nameplate's pt-[9px] also puts the wordmark's ink top at 22px — with the top of the wordmark
// at scroll-top. One value covers both breakpoints: the nameplate's pt-[9px] doesn't scale.
const TOGGLE_TOP = 22;

const USE_24H_KEY = "world-happyhour-24h";
const SORT_ETW_KEY = "world-happyhour-sort-etw";
const ZONES_KEY = "world-happyhour-zones";
const SHOW_REL_TIME_KEY = "world-happyhour-rel-time";

export default function WorldClock() {
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [selectedTime, setSelectedTime] = useState<Date | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [use24Hour, setUse24Hour] = useState(() => {
    return localStorage.getItem(USE_24H_KEY) === "true";
  });
  const [sortEastToWest, setSortEastToWest] = useState(() => {
    return localStorage.getItem(SORT_ETW_KEY) === "true";
  });
  const [showRelativeTime, setShowRelativeTime] = useState(() => {
    return localStorage.getItem(SHOW_REL_TIME_KEY) === "true";
  });
  const [selectedZones, setSelectedZones] = useState<string[]>(initZonesFromStorage);
  // Owned here rather than in TimeZoneConverter (where geolocation is resolved) only because
  // SiteFooter — which shows the "allow location" notice — is a sibling, not a descendant.
  const [geoDenied, setGeoDenied] = useState(false);
  const { theme, setTheme, resolvedTheme } = useTheme();
  const logoVariant = resolvedTheme === "happy" ? "happy" : "default";
  // Figma spec per theme: light/happy wordmark = #000000, dark = white.
  const wordmarkColor = resolvedTheme === "dark" ? "#FFFFFF" : "#000000";
  // Scroll-driven hero shrink. JS writes one number and nothing else: every size, and the
  // breakpoint itself, lives in index.css (.hero-time / .hero-clock / .hero-sticky). Writing a
  // custom property rather than React state keeps this off the render path — no re-render per frame.
  useEffect(() => {
    function updateHeroRatio() {
      const ratio = Math.min(1, Math.max(0, window.scrollY / SCROLL_RANGE));
      document.documentElement.style.setProperty("--hero-ratio", String(ratio));
    }

    window.addEventListener("scroll", updateHeroRatio, { passive: true });
    updateHeroRatio(); // set initial state
    return () => window.removeEventListener("scroll", updateHeroRatio);
  }, []);

  // Persist settings
  useEffect(() => {
    localStorage.setItem(USE_24H_KEY, String(use24Hour));
  }, [use24Hour]);

  useEffect(() => {
    localStorage.setItem(SORT_ETW_KEY, String(sortEastToWest));
  }, [sortEastToWest]);

  useEffect(() => {
    localStorage.setItem(SHOW_REL_TIME_KEY, String(showRelativeTime));
  }, [showRelativeTime]);

  useEffect(() => {
    localStorage.setItem(ZONES_KEY, JSON.stringify(selectedZones));
  }, [selectedZones]);

  const { syncStatus } = useCloudSync({
    preferences: {
      zones: selectedZones,
      use24h: use24Hour,
      sortEastToWest,
      showRelativeTime,
      theme: theme as "light" | "dark" | "happy" | "system",
    },
    setPreferences: useCallback((prefs: { zones: string[]; use24h: boolean; sortEastToWest: boolean; showRelativeTime: boolean; theme: "light" | "dark" | "happy" | "system" }) => {
      setSelectedZones(prefs.zones);
      setUse24Hour(prefs.use24h);
      setSortEastToWest(prefs.sortEastToWest);
      setShowRelativeTime(prefs.showRelativeTime);
      setTheme(prefs.theme);
    }, [setTheme]),
  });

  function handleTimeUpdate(zoneKey: string, hours: number, minutes: number) {
    const city = getCityByKey(zoneKey);
    if (!city) return;

    const now = new Date();
    const inputTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0);
    const utcTime = new Date(inputTime.getTime() - (city.offset * 3600000) - (inputTime.getTimezoneOffset() * 60000));

    setSelectedTime(utcTime);
    setIsCustomMode(true);
    track("custom_time_set");
  }

  function handleReset() {
    setIsCustomMode(false);
    setSelectedTime(null);
    track("custom_time_reset");
  }

  const handleCloseSidebar = useCallback(() => setSidebarOpen(false), []);

  function handleToggleSidebar() {
    setSidebarOpen((prev) => {
      if (!prev) track("sidebar_opened");
      return !prev;
    });
  }

  function handleToggle24Hour(value: boolean) {
    setUse24Hour(value);
    track("toggle_24h", { enabled: value });
  }

  function handleToggleSortEastToWest(value: boolean) {
    setSortEastToWest(value);
    track("toggle_east_west_sort", { enabled: value });
  }

  function handleToggleShowRelativeTime(value: boolean) {
    setShowRelativeTime(value);
    track("toggle_relative_time", { enabled: value });
  }

  return (
    // The +120px is a scroll runway, not decoration. The hero shrinks by ~94px as you scroll,
    // which SHORTENS the document; on a page that is only barely scrollable (one row of tiles on
    // a tall display) that pulls maxScroll below the current scrollY, the browser clamps you back
    // up, --hero-ratio drops, the hero grows again — and the shrink converges to a fixed point
    // (measured: 0.24) instead of reaching 1. The logo never fully clears the top and the easing
    // judders. Flooring main's height decouples the document height from the hero's height, so the
    // feedback loop cannot form, and guarantees SCROLL_RANGE is always reachable.
    // lvh (not dvh/svh) keeps the runway intact in every mobile URL-bar state.
    <main className="min-h-[calc(100lvh+120px)] bg-background flex flex-col">
      {/* Logo bar. Deliberately NOT sticky and with no bottom rule: it scrolls away off the top,
          leaving the hero clock's rule as the only one at the top of the viewport. The logo and the
          hero read as a single unit (Figma 329:3241). */}
      {/* pt-[13px] (not Figma's 29px): 13 + the nameplate's pt-[9px] puts the wordmark's ink top at
          22px, the same y as the pinned drawer icon and as the city name once the hero is sticky.
          Deliberate departure from Figma 329:3242 — see docs/2026-07-14-devlog.md. */}
      <header className="bg-background px-6 md:px-12 lg:px-24 pt-[13px] pb-[10px]">
        <div className="mx-auto max-w-4xl flex flex-row items-center pl-[10px]">
          <h1
            className="flex items-center gap-[10px] min-w-0"
            data-testid="text-app-title"
          >
            {/* Nameplate: pt-[9px] matches Figma so the logo's vertical center aligns with the wordmark's
                visual center (not the bounding-box center — the wordmark glyphs sit low in their viewBox). */}
            <div className="flex flex-col items-start pt-[9px] shrink-0">
              <HappyhourWordmark
                className="shrink-0 h-[43px] max-[499px]:h-[31.39px] w-auto"
                style={{ color: wordmarkColor }}
              />
            </div>
            {/* Round mark sits to the RIGHT of the wordmark (Figma 329:3382 → 329:3381).
                0.73 below 500px matches the Figma mobile variant ratio (31.68 / 43.392);
                mt-[2px] there nudges the scaled mark down so its top edge aligns with the
                top of the "H" cap in the wordmark. */}
            <HappyhourLogo
              variant={logoVariant}
              className="shrink-0 size-[38px] max-[499px]:size-[27.74px] max-[499px]:mt-[2px]"
            />
            <span className="sr-only">Happyhour</span>
          </h1>
        </div>
      </header>

      {/* Menu layer — fixed, mirrors the content column's horizontal layout exactly.
          The drawer toggle lives HERE rather than in the header for two reasons:
          (1) the header scrolls away, and the toggle must not move by a single pixel;
          (2) its horizontal offset and the sidebar's close-icon offset now derive from the
              same max-w-4xl column, so they align structurally instead of by two padding
              values that happen to match. The panel sits at right-[-10px] with pr-[20px]
              inside, putting its close icon at column_right − 10px; right-[10px] here is
              that same offset. Do NOT give the button a z-index: the panel (z-70) must cover
              it when open, so the sidebar's own close icon takes over in place. */}
      <nav
        aria-label="Main menu"
        className="fixed inset-x-0 top-0 bottom-0 z-[55] px-6 md:px-12 lg:px-24 pointer-events-none"
      >
        <div className="mx-auto max-w-4xl relative h-full">
          <button
            onClick={handleToggleSidebar}
            style={{ top: `${TOGGLE_TOP}px` }}
            className="absolute right-[10px] pointer-events-auto text-[#6B7280] hover:text-[#374151] transition-colors"
            aria-label={sidebarOpen ? "Close menu" : "Open menu"}
            aria-expanded={sidebarOpen}
            aria-controls="app-sidebar"
            data-testid="button-drawer-toggle"
          >
            <DrawerToggleIcon open={sidebarOpen} />
          </button>
          <Sidebar
            open={sidebarOpen}
            onClose={handleCloseSidebar}
            use24Hour={use24Hour}
            onToggle24Hour={handleToggle24Hour}
            sortEastToWest={sortEastToWest}
            onToggleSortEastToWest={handleToggleSortEastToWest}
            showRelativeTime={showRelativeTime}
            onToggleShowRelativeTime={handleToggleShowRelativeTime}
            topOffset={TOGGLE_TOP}
            syncStatus={syncStatus}
          />
        </div>
      </nav>

      {/* Offline banner — a yellow band under the logo bar whenever navigator.onLine is false.
          The 10px lead-in is on the banner itself, not this wrapper: OfflineBanner renders null
          when online, and a wrapper with padding would hold that gap open permanently, pushing
          the hero away from the logo. */}
      <div className="px-6 md:px-12 lg:px-24">
        <div className="mx-auto max-w-4xl">
          <OfflineBanner />
        </div>
      </div>

      {/* flex-1 lets the tile-grid region grow to fill available space so the
          SiteFooter below pins to the bottom on short pages.
          pt-0: Figma puts the hero immediately below the logo bar — the only gap is the
          header's own pb-[10px]. */}
      <div className="flex-1 px-6 pt-0 pb-8 md:px-12 lg:px-24">
        <div className="mx-auto max-w-4xl">
          <TimeZoneConverter
            isCustomMode={isCustomMode}
            selectedTime={selectedTime}
            onTimeUpdate={handleTimeUpdate}
            onReset={handleReset}
            use24Hour={use24Hour}
            sortEastToWest={sortEastToWest}
            onSortEastToWestChange={setSortEastToWest}
            showRelativeTime={showRelativeTime}
            selectedZones={selectedZones}
            onZonesChange={setSelectedZones}
            onGeoDeniedChange={setGeoDenied}
          />
        </div>
      </div>

      <SiteFooter geoDenied={geoDenied} />
    </main>
  );
}
