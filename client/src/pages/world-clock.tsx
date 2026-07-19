import { useState, useEffect, useCallback, useRef } from "react";
import { TimeZoneConverter } from "@/components/time-zone-converter";
import { SharedLinkView } from "@/components/shared-link-view";
import { SharedLinkAuthController } from "@/components/shared-link-auth-controller";
import { RegistrationBar } from "@/components/registration-bar";
import { Sidebar, DrawerToggleIcon } from "@/components/sidebar";
import { getCityByKey, loadCities, loadTopCities } from "@/lib/city-lookup";
import { useCloudSync } from "@/hooks/use-cloud-sync";
import { useTheme } from "@/lib/theme-provider";
import { initZonesFromStorage, MAX_CLOCKS } from "@/components/time-zone-converter";
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

// Clerk only mounts when a publishable key is compiled in (the test/CI build omits it on purpose),
// so gate anything that calls a Clerk hook — like the Registration Bar — on this. Same const the
// sidebar and use-cloud-sync use to avoid calling Clerk hooks without a provider.
const isClerkConfigured = !!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

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
  // Incoming shared link: valid city keys (+ optional frozen instant) parsed from ?z=/&t=.
  // Non-null puts the page into the Sharing View instead of the clock board.
  const [shareImport, setShareImport] = useState<{ keys: string[]; t: number | null } | null>(null);
  // Cities to flash on arrival, handed to the board when the Sharing View retires. Cleared once
  // the animation has had time to play; it's a one-shot, not a lasting property of the tiles.
  const [highlightedZones, setHighlightedZones] = useState<string[]>([]);
  // Account Registration Bar, both in-memory by design (Khoi, 2026-07-18): it appears only once
  // the visitor has added a clock *this session* — a returning signed-out user who adds nothing
  // won't see it — and Cancel hides it for the session, not for good.
  const [addedThisSession, setAddedThisSession] = useState(false);
  const [regDismissed, setRegDismissed] = useState(false);
  // A shared link's *keys* resolve asynchronously (they need the city lookup loaded), but whether
  // the URL carries ?z= at all is knowable synchronously — so the board is held back until we
  // know. Otherwise the recipient's own clocks mount and paint for a frame before the Sharing View
  // replaces them, and worse: mounting the board resolves geolocation, so a denied prompt leaves
  // the footer's "allow location for more precise local time" notice stuck on a surface that shows
  // no local time at all.
  const [sharePending, setSharePending] = useState(() => {
    try {
      return new URLSearchParams(window.location.search).has("z");
    } catch {
      return false;
    }
  });
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

  // Latest share-resolve wins: a stale async resolution (e.g. a rapid Back/Forward) must not write
  // over a newer one. Bumped each call; only the matching token may commit.
  const shareResolveToken = useRef(0);

  /** Read ?z= / ?t= from the *current* URL and enter or leave the Sharing View accordingly. Keys
   *  resolve AFTER the city lookup is loaded (it loads async, and getCityByKey returns undefined
   *  before then — resolving too early would silently drop every shared city). Called on mount and
   *  again on every popstate, so browser Back/Forward across the share↔board boundary re-resolves. */
  const resolveShareFromLocation = useCallback(() => {
    // Every exit path must settle sharePending, or a link that resolves to nothing would leave the
    // board held back forever on a blank page.
    const settled = () => setSharePending(false);
    let rawKeys: string | null = null;
    let rawT: string | null = null;
    try {
      const params = new URLSearchParams(window.location.search);
      rawKeys = params.get("z");
      rawT = params.get("t");
    } catch {
      setShareImport(null);
      settled();
      return;
    }
    // No share in the URL — e.g. Back to the board after adding, or Forward past a consumed share.
    if (!rawKeys) {
      setShareImport(null);
      settled();
      return;
    }
    const candidates = rawKeys.split(",").map((k) => k.trim()).filter(Boolean);
    if (candidates.length === 0) {
      setShareImport(null);
      settled();
      return;
    }
    const tNum = rawT ? Number(rawT) : NaN;
    const t = Number.isFinite(tNum) ? tNum : null;

    const token = ++shareResolveToken.current;
    // The top tier is 500 cities; the full set is 30k. A sender can share any of them, so resolving
    // against the top tier alone silently dropped 98% of the map — and the headline then counted the
    // survivors and stated the wrong number with total confidence. Try the cheap tier first (most
    // links are big cities, and it's already in the initial payload), and only pay for the 2 MB when
    // a key isn't in it. Keys are stable across the two tiers — cities-top.json is a
    // population-ordered prefix of cities.json, and key collisions resolve by descending population,
    // so both derive the same key for the same city — which is what makes this fallback safe.
    loadTopCities()
      .then(() => {
        if (token !== shareResolveToken.current || candidates.every((k) => getCityByKey(k))) return;
        // A failed full load is not fatal: fall through and show whatever the top tier resolved.
        return loadCities().catch(() => undefined);
      })
      .then(() => {
        if (token !== shareResolveToken.current) return;
        const keys = candidates.filter((k) => getCityByKey(k));
        if (keys.length > 0) {
          setShareImport({ keys, t });
          track("share_link_opened", { count: keys.length });
        } else {
          setShareImport(null);
        }
        // Batched with setShareImport above, so the board and the Sharing View never both render.
        settled();
      });
  }, []);

  useEffect(() => {
    resolveShareFromLocation();
  }, [resolveShareFromLocation]);

  // Browser Back/Forward across the share→board boundary. handleAddShared pushes a clean URL on top
  // of the ?z= entry, so Back restores the share URL here — re-resolve it as a pure SPA transition
  // (no reload). wouter ignores the query string, so it won't fight this.
  useEffect(() => {
    window.addEventListener("popstate", resolveShareFromLocation);
    return () => window.removeEventListener("popstate", resolveShareFromLocation);
  }, [resolveShareFromLocation]);

  /** Merge the cities the recipient chose in the Sharing View.
   *
   *  `chosen` can't exceed the cap — the Sharing View won't let more be selected than the board can
   *  hold — so the slice here is a guard, not the mechanism. That's the point: the cap is enforced
   *  where the recipient can still do something about it, rather than silently truncating after
   *  they've agreed to a list. Highlighting is what tells them which tiles are new.
   *
   *  Counts come from `chosen`, not from a state updater: StrictMode double-invokes updaters, so
   *  counting inside one would double every number. */
  function handleAddShared(chosen: string[]) {
    if (!shareImport) return;
    const merged = [...selectedZones];
    for (const k of chosen) if (!merged.includes(k)) merged.push(k);
    const added = chosen.filter((k) => !selectedZones.includes(k));

    setSelectedZones(merged.slice(0, MAX_CLOCKS));
    setHighlightedZones(added);
    // Accepting shared clocks counts as adding this session, so the recipient lands on the board
    // with the Registration Bar up — but only if they actually took something new.
    if (added.length > 0) setAddedThisSession(true);
    if (shareImport.t != null) {
      setSelectedTime(new Date(shareImport.t));
      setIsCustomMode(true);
    }
    // `count` stays what the link offered, so share_link_opened → share_link_added still compares;
    // `added` is what the recipient took, and `capped` records whether the 16-limit was what
    // stopped them taking the rest (as opposed to simply not wanting them).
    track("share_link_added", {
      count: shareImport.keys.length,
      added: added.length,
      capped: shareImport.keys.filter((k) => !selectedZones.includes(k)).length > MAX_CLOCKS - selectedZones.length,
    });
    setShareImport(null);
    // Push a clean URL *on top of* the ?z= entry (rather than replacing it), so the browser Back
    // button returns to the Sharing View — the popstate listener re-resolves the restored URL. A
    // later refresh on the clean URL still shows the board, since ?z=/?t= are no longer current.
    try {
      window.history.pushState(null, "", window.location.pathname);
    } catch {
      /* history blocked — the added clocks still stand; a refresh would just re-enter the view */
    }
  }

  /** The recipient dismissed the Commit Bar (Select Mode → Resting). Analytics only — the view
   *  stays; escaping it is the logo's job. */
  function handleShareBarDismissed() {
    if (shareImport) track("share_link_dismissed", { count: shareImport.keys.length });
  }

  // Retire the arrival highlight once it has had time to play. Not cosmetic housekeeping: the
  // highlight branch sits above hover in the tile's state chain, so leaving it set would cost
  // those tiles their hover state for the rest of the session.
  useEffect(() => {
    if (highlightedZones.length === 0) return;
    const id = setTimeout(() => setHighlightedZones([]), 2000); // = the animation's duration
    return () => clearTimeout(id);
  }, [highlightedZones]);

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
      {/* In the Sharing View the logo is the way out: a real link to the main board. It's a full
          navigation on purpose — Back then reloads the shared URL and re-enters the view (the params
          are no longer stripped), which is far more reliable than reconstructing it from SPA history.
          It also pins on scroll there (the Sharing View has no hero to be the sticky element). */}
      <LogoBar linkHome={Boolean(shareImport)} sticky={Boolean(shareImport)} />

      {/* Menu layer — fixed, mirrors the content column's horizontal layout exactly.
          The drawer toggle lives HERE rather than in the header for two reasons:
          (1) the header scrolls away, and the toggle must not move by a single pixel;
          (2) its horizontal offset and the sidebar's close-icon offset now derive from the
              same max-w-4xl column, so they align structurally instead of by two padding
              values that happen to match. The panel sits at right-[-10px] with pr-[20px]
              inside, putting its close icon at column_right − 10px; right-[10px] here is
              that same offset. Do NOT give the button a z-index: the panel (z-70) must cover
              it when open, so the sidebar's own close icon takes over in place. */}
      {/* The drawer now rides along in the Sharing View too (2026-07-19): the icon pins beside the
          sticky branding and the panel works as on the dashboard (theme, 24h, Login, sync). Sort and
          Show-Relative-Time set the visitor's own prefs but don't reorder the shared tiles — they
          render in the sender's order — so they're silent no-ops here until the visitor's own board.
          Still hidden during `sharePending` (the brief async resolve, when there's nothing yet). */}
      <nav
        aria-label="Main menu"
        hidden={sharePending}
        className="fixed inset-x-0 top-0 bottom-0 z-[55] px-6 md:px-12 lg:px-24 pointer-events-none"
      >
        <div className="mx-auto max-w-4xl relative h-full">
          <button
            onClick={handleToggleSidebar}
            disabled={shareActive}
            style={{ top: `${TOGGLE_TOP}px` }}
            /* Color tracks the theme instead of a hardcoded gray: the normal state matches the
               "Add Clock" button (both text-muted-foreground, so Happy reads #4D4D4D not #6B7280),
               and the inert select-mode state is the same token dimmed — always lower-contrast than
               normal in every theme, which is what stops dark mode from inverting (its old #C4C7CC
               read brighter than the normal #6B7280 on a dark ground). */
            className={`absolute right-[10px] transition-colors ${
              shareActive
                ? "text-muted-foreground/40 pointer-events-none"
                : "pointer-events-auto text-muted-foreground hover:text-foreground"
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
          {shareImport ? (
            // Clerk-configured builds route through the auth controller (register vs commit mode,
            // new-registrant auto-add). The no-Clerk test/CI build renders the plain view in its
            // unchanged Commit-Bar mode, so no Clerk hook ever runs without a provider.
            isClerkConfigured ? (
              <SharedLinkAuthController
                keys={shareImport.keys}
                t={shareImport.t}
                ownedKeys={selectedZones}
                use24Hour={use24Hour}
                onAdd={handleAddShared}
                onDismiss={handleShareBarDismissed}
              />
            ) : (
              <SharedLinkView
                keys={shareImport.keys}
                t={shareImport.t}
                ownedKeys={selectedZones}
                use24Hour={use24Hour}
                onAdd={handleAddShared}
                onDismiss={handleShareBarDismissed}
              />
            )
          ) : sharePending ? null : (
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
              highlightedZones={highlightedZones}
              onClockAdded={() => setAddedThisSession(true)}
            />
          )}
        </div>
      </div>

      {/* Account onboarding nudge. A sibling of the view conditional so it rides over the board but
          never a share flow (its own CommitBar owns the bottom then). Gated on isClerkConfigured so
          RegistrationBar's useAuth() only runs with a provider; the mutually-exclusive conditions
          keep exactly one bottom bar mounted, so the footer clearance never doubles. */}
      {isClerkConfigured && addedThisSession && !regDismissed && !shareActive && !shareImport && (
        <RegistrationBar onDismiss={() => setRegDismissed(true)} />
      )}

      <SiteFooter geoDenied={geoDenied} />
    </main>
  );
}
