import { useState, useEffect, useRef, useCallback } from "react";
import { TimeZoneConverter } from "@/components/time-zone-converter";
import { Sidebar, DrawerToggleIcon } from "@/components/sidebar";
import { getCityByKey } from "@/lib/city-lookup";

// Header animation constants
const SCROLL_RANGE = 120; // px of scroll over which the shrink fully plays out
const PY_START = 32;      // py-8 = 2rem = 32px
const PY_END = 12;        // py-3 = 0.75rem = 12px
const FS_START = 48;      // text-5xl = 3rem = 48px
const FS_END = 30;        // text-3xl = 1.875rem = 30px

const USE_24H_KEY = "world-khlock-24h";
const SORT_ETW_KEY = "world-khlock-sort-etw";

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
  const [sidebarTop, setSidebarTop] = useState(28);
  const headerRef = useRef<HTMLElement>(null);
  const h1Ref = useRef<HTMLHeadingElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  // Scroll-driven header shrink + sidebar top tracking
  useEffect(() => {
    function updateHeader() {
      const ratio = Math.min(1, Math.max(0, window.scrollY / SCROLL_RANGE));
      if (headerRef.current) {
        const pyBottom = PY_START + (PY_END - PY_START) * ratio;
        headerRef.current.style.paddingBottom = `${pyBottom}px`;
      }
      if (h1Ref.current) {
        const fs = FS_START + (FS_END - FS_START) * ratio;
        h1Ref.current.style.fontSize = `${fs}px`;
        h1Ref.current.style.lineHeight = `${fs}px`;
      }
      // Update sidebar top to align with the toggle button
      if (toggleRef.current) {
        const rect = toggleRef.current.getBoundingClientRect();
        setSidebarTop(rect.top);
      }
    }

    window.addEventListener("scroll", updateHeader, { passive: true });
    updateHeader(); // set initial position
    return () => window.removeEventListener("scroll", updateHeader);
  }, []);

  // Persist settings
  useEffect(() => {
    localStorage.setItem(USE_24H_KEY, String(use24Hour));
  }, [use24Hour]);

  useEffect(() => {
    localStorage.setItem(SORT_ETW_KEY, String(sortEastToWest));
  }, [sortEastToWest]);

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
        <div className="mx-auto max-w-4xl flex flex-row items-start justify-between gap-4 pl-[10px] pr-[10px]">
          <h1
            ref={h1Ref}
            className="font-display font-black tracking-tight text-foreground text-5xl"
            data-testid="text-app-title"
          >
            Khlock
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
            topOffset={sidebarTop}
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
          />
        </div>
      </div>
    </main>
  );
}
