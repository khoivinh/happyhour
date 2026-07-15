import { useState, useEffect, useCallback } from "react";
import { TimeZoneConverter } from "@/components/time-zone-converter";
import { Sidebar, DrawerToggleIcon } from "@/components/sidebar";
import { getCityByKey, loadTopCities } from "@/lib/city-lookup";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCloudSync } from "@/hooks/use-cloud-sync";
import { useTheme } from "@/lib/theme-provider";
import { initZonesFromStorage } from "@/components/time-zone-converter";
import { LogoBar } from "@/components/logo-bar";
import { OfflineBanner } from "@/components/offline-banner";
import { SiteFooter } from "@/components/site-footer";
import { track } from "@/lib/analytics";

// px of scroll over which the hero shrink fully plays out. The logo bar is ~75px tall, so
// the hero has locked to the top of the viewport before the shrink completes.
// MUST stay in sync with the +120px scroll runway in <main>'s min-height below — that runway
// is what guarantees this range is always reachable.
const SCROLL_RANGE = 120;

// The drawer toggle is pinned: it must not move by a single pixel at any scroll offset.
// 32px aligns the top of its icon with the top of the city name's glyphs once the hero is
// sticky (measured: city ink top = 32.28px), and — because LogoBar's pt-[23px] plus the
// nameplate's pt-[9px] also puts the wordmark's ink top at 32px — with the top of the wordmark
// at scroll-top. One value covers both breakpoints: the nameplate's pt-[9px] doesn't scale.
//
// This ALSO sets the menu panel's position: Sidebar takes it as topOffset and sits at
// topOffset − 18, with a matching pt-[18px] inside, so the panel's close icon lands exactly on
// this button and the icon doesn't jump when the menu opens. The panel therefore cannot be moved
// independently of the toggle — raising this value is the only way to push the panel further from
// the top of the viewport. At 32 the panel's top edge sits at 14px.
const TOGGLE_TOP = 32;

const USE_24H_KEY = "world-happyhour-24h";
const SORT_ETW_KEY = "world-happyhour-sort-etw";
const ZONES_KEY = "world-happyhour-zones";
const SHOW_REL_TIME_KEY = "world-happyhour-rel-time";

/** "Tokyo, Paris, and London" for ≤3; "Tokyo, Paris, and 4 more" beyond. Uses bare city names
 *  (not the province-qualified display) so commas within names don't fracture the sentence. */
function formatSharedCityList(keys: string[]): string {
  const names = keys
    .map((k) => {
      const c = getCityByKey(k);
      return c ? c.name : null;
    })
    .filter((n): n is string => n !== null);
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  if (names.length === 3) return `${names[0]}, ${names[1]}, and ${names[2]}`;
  return `${names[0]}, ${names[1]}, and ${names.length - 2} more`;
}

/** A frozen shared instant rendered in the recipient's local time, e.g. "3:00 PM · Jul 15". */
function formatFrozenTime(t: number, use24h: boolean): string {
  const d = new Date(t);
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", hour12: !use24h });
  const date = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${time} · ${date}`;
}

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
  // Mirror of the converter's share select-mode, reported up so the drawer toggle grays out
  // (and goes inert) while the user is picking cities to share.
  const [shareActive, setShareActive] = useState(false);
  // Incoming shared link: valid city keys (+ optional frozen instant) parsed from ?z=/&t=,
  // held for the preview/confirm dialog. Null when there's nothing to offer.
  const [shareImport, setShareImport] = useState<{ keys: string[]; t: number | null } | null>(null);
  const { theme, setTheme } = useTheme();
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

  // Parse an incoming shared link once on load: read ?z= / ?t=, strip the params immediately so
  // a refresh never re-prompts, then resolve the keys AFTER the city lookup is loaded (it loads
  // async, and getCityByKey returns undefined before then — resolving too early would silently
  // drop every shared city). Unknown keys are dropped; a valid set feeds the preview dialog.
  useEffect(() => {
    let rawKeys: string | null = null;
    let rawT: string | null = null;
    try {
      const params = new URLSearchParams(window.location.search);
      rawKeys = params.get("z");
      rawT = params.get("t");
    } catch {
      return;
    }
    if (!rawKeys) return;
    try {
      window.history.replaceState(null, "", window.location.pathname);
    } catch {
      /* history blocked — the dialog still works, refresh may re-prompt */
    }
    const candidates = rawKeys.split(",").map((k) => k.trim()).filter(Boolean);
    if (candidates.length === 0) return;
    const tNum = rawT ? Number(rawT) : NaN;
    const t = Number.isFinite(tNum) ? tNum : null;

    let cancelled = false;
    loadTopCities().then(() => {
      if (cancelled) return;
      const keys = candidates.filter((k) => getCityByKey(k));
      if (keys.length === 0) return;
      setShareImport({ keys, t });
      track("share_link_opened", { count: keys.length });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function handleAddShared() {
    if (!shareImport) return;
    setSelectedZones((prev) => {
      const merged = [...prev];
      for (const k of shareImport.keys) if (!merged.includes(k)) merged.push(k);
      return merged.slice(0, 16); // same 16-zone cap as cloud sync
    });
    if (shareImport.t != null) {
      setSelectedTime(new Date(shareImport.t));
      setIsCustomMode(true);
    }
    track("share_link_added", { count: shareImport.keys.length });
    setShareImport(null);
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
      <LogoBar />

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
            disabled={shareActive}
            style={{ top: `${TOGGLE_TOP}px` }}
            className={`absolute right-[10px] transition-colors ${
              shareActive
                ? "text-[#C4C7CC] pointer-events-none"
                : "pointer-events-auto text-[#6B7280] hover:text-[#374151]"
            }`}
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
            onShareModeChange={setShareActive}
          />
        </div>
      </div>

      <SiteFooter geoDenied={geoDenied} />

      <Dialog open={!!shareImport} onOpenChange={(o) => { if (!o) setShareImport(null); }}>
        <DialogContent className="bg-card text-card-foreground sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="font-display text-[19px] font-black tracking-[-0.01em]">
              Add shared clocks?
            </DialogTitle>
            <DialogDescription>
              {shareImport && (
                <>
                  Add {formatSharedCityList(shareImport.keys)} to your clocks
                  {shareImport.t != null && <> at {formatFrozenTime(shareImport.t, use24Hour)}</>}?
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setShareImport(null)}
              className="inline-flex items-center justify-center rounded-md border border-input bg-transparent px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
              data-testid="button-share-import-cancel"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAddShared}
              autoFocus
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              data-testid="button-share-import-add"
            >
              Add
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
