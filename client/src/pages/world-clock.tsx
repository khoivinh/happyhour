import { useState, useEffect, useRef, useCallback } from "react";
import { TimeZoneConverter } from "@/components/time-zone-converter";
import { Sidebar, DrawerToggleIcon } from "@/components/sidebar";
import { getCityByKey } from "@/lib/city-lookup";
import { useCloudSync } from "@/hooks/use-cloud-sync";
import { useTheme } from "@/lib/theme-provider";
import { initZonesFromStorage } from "@/components/time-zone-converter";
import { HappyhourLogo } from "@/components/icons/happyhour-logo";
import { HappyhourWordmark } from "@/components/icons/happyhour-wordmark";
import { OfflineBanner } from "@/components/offline-banner";

// Header animation constants
const SCROLL_RANGE = 120; // px of scroll over which the shrink fully plays out
const PY_START = 32;      // py-8 = 2rem = 32px
const PY_END = 12;        // py-3 = 0.75rem = 12px
const LOGO_START = 38;    // Figma node 182:1510
const LOGO_END = 25;
const WORDMARK_H_START = 43; // Figma node 211:2310 desktop (43.392 rounded)
const WORDMARK_H_END = 28;

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
  const { theme, setTheme, resolvedTheme } = useTheme();
  const logoVariant = resolvedTheme === "happy" ? "happy" : "default";
  // Figma spec per theme: light/happy wordmark = #000000, dark = white.
  const wordmarkColor = resolvedTheme === "dark" ? "#FFFFFF" : "#000000";
  const [sidebarTop, setSidebarTop] = useState(28);
  const headerRef = useRef<HTMLElement>(null);
  const logoRef = useRef<SVGSVGElement>(null);
  const wordmarkRef = useRef<SVGSVGElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  // Scroll-driven header shrink + sidebar top tracking
  useEffect(() => {
    function updateHeader() {
      const ratio = Math.min(1, Math.max(0, window.scrollY / SCROLL_RANGE));
      // Shrink logo + wordmark on narrow viewports so the header fits on iPhone SE / small phones.
      // 0.73 matches the Figma "Mobile Logged In" variant ratio (31.68 / 43.392).
      const mobileScale = window.innerWidth < 500 ? 0.73 : 1;
      if (headerRef.current) {
        const pyBottom = PY_START + (PY_END - PY_START) * ratio;
        headerRef.current.style.paddingBottom = `${pyBottom}px`;
      }
      if (logoRef.current) {
        const size = (LOGO_START + (LOGO_END - LOGO_START) * ratio) * mobileScale;
        logoRef.current.style.width = `${size}px`;
        logoRef.current.style.height = `${size}px`;
      }
      if (wordmarkRef.current) {
        const h = (WORDMARK_H_START + (WORDMARK_H_END - WORDMARK_H_START) * ratio) * mobileScale;
        wordmarkRef.current.style.height = `${h}px`;
      }
      // Update sidebar top to align with the toggle button
      if (toggleRef.current) {
        const rect = toggleRef.current.getBoundingClientRect();
        setSidebarTop(rect.top);
      }
    }

    window.addEventListener("scroll", updateHeader, { passive: true });
    window.addEventListener("resize", updateHeader, { passive: true });
    updateHeader(); // set initial position
    return () => {
      window.removeEventListener("scroll", updateHeader);
      window.removeEventListener("resize", updateHeader);
    };
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
  }

  function handleReset() {
    setIsCustomMode(false);
    setSelectedTime(null);
  }

  const handleCloseSidebar = useCallback(() => setSidebarOpen(false), []);

  return (
    <main className="min-h-screen bg-background">
      {/* Sticky header */}
      <header
        ref={headerRef}
        className="sticky top-0 z-50 bg-background border-b border-border px-6 md:px-12 lg:px-24 py-8"
      >
        {/* pr-[10px] at every breakpoint is load-bearing: the drawer toggle (closed state)
            must horizontally align with the sidebar's close icon (open state). Sidebar panel
            sits at right-[-10px] with pr-[20px] inside, putting its close icon at
            max_w_4xl_right − 10px. The header's pr must match that same offset. Do NOT
            reintroduce sm:pr-[20px] — it shifts the closed-state icon 10px left of the open-state icon on desktop. */}
        <div className="mx-auto max-w-4xl flex flex-row items-center justify-between gap-4 pl-[10px] pr-[10px]">
          <h1
            className="flex items-center gap-[10px] min-w-0"
            data-testid="text-app-title"
          >
            <HappyhourLogo
              ref={logoRef}
              variant={logoVariant}
              // mt-[2px] on mobile <500px nudges the scaled logo down so its top edge
              // aligns with the top of the "H" cap in the wordmark.
              className="shrink-0 max-[499px]:mt-[2px]"
              style={{ width: `${LOGO_START}px`, height: `${LOGO_START}px` }}
            />
            {/* Nameplate: pt-[9px] matches Figma so the logo's vertical center aligns with the wordmark's
                visual center (not the bounding-box center — the wordmark glyphs sit low in their viewBox). */}
            <div className="flex flex-col items-start pt-[9px] shrink-0">
              <HappyhourWordmark
                ref={wordmarkRef}
                className="shrink-0"
                style={{ height: `${WORDMARK_H_START}px`, width: "auto", color: wordmarkColor }}
              />
            </div>
            <span className="sr-only">Happyhour</span>
          </h1>
          <button
            ref={toggleRef}
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
            aria-label={sidebarOpen ? "Close menu" : "Open menu"}
            data-testid="button-drawer-toggle"
          >
            <DrawerToggleIcon open={sidebarOpen} />
          </button>
        </div>
      </header>

      {/* Offline banner — renders a yellow band under the sticky header whenever navigator.onLine is false. */}
      <div className="px-6 md:px-12 lg:px-24 pt-[10px]">
        <div className="mx-auto max-w-4xl">
          <OfflineBanner />
        </div>
      </div>

      {/* Sidebar positioning wrapper — fixed, mirrors content horizontal layout */}
      <div className="fixed inset-x-0 top-0 bottom-0 z-[55] px-6 md:px-12 lg:px-24 pointer-events-none">
        <div className="mx-auto max-w-4xl relative h-full">
          <Sidebar
            open={sidebarOpen}
            onClose={handleCloseSidebar}
            use24Hour={use24Hour}
            onToggle24Hour={setUse24Hour}
            sortEastToWest={sortEastToWest}
            onToggleSortEastToWest={setSortEastToWest}
            showRelativeTime={showRelativeTime}
            onToggleShowRelativeTime={setShowRelativeTime}
            topOffset={sidebarTop}
            syncStatus={syncStatus}
          />
        </div>
      </div>

      <div className="px-6 py-8 md:px-12 lg:px-24">
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
          />
        </div>
      </div>
    </main>
  );
}
