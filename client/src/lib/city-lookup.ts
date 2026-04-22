import { FEATURED_CITY_KEYS } from "./featured-cities";

export interface CityData {
  city: string;
  country: string;
  timezone: string;
  province?: string;
  lat: number;
  lng: number;
  population?: number;
}

interface RawCity {
  city: string;
  city_ascii: string;
  lat: number;
  lng: number;
  pop: number;
  country: string;
  iso2: string;
  province: string;
  state_ansi: string;
  timezone: string;
}

export interface TimezoneOption {
  key: string;
  name: string;
  gmtLabel: string;
  offset: number;
  timezone: string;
  country: string;
  iso2: string;
  province?: string;
  stateAnsi?: string;
  lat: number;
  lng: number;
}

/** Format city name with province/state for disambiguation.
 *  US cities: "San Jose, CA". Non-US: "Toronto, Ontario". Omits province if missing or same as city name. */
export function formatCityDisplay(city: TimezoneOption): string {
  if (!city.province || city.province === city.name) return city.name;
  if (city.iso2 === "US" && city.stateAnsi) return `${city.name}, ${city.stateAnsi}`;
  return `${city.name}, ${city.province}`;
}

/** Format the detail line (province + country) for dropdowns. */
export function formatCityDetail(city: TimezoneOption): string {
  if (city.province && city.province !== city.name) {
    return `${city.province}, ${city.country} (${city.gmtLabel})`;
  }
  return `${city.country} (${city.gmtLabel})`;
}

// --- Module state ---

interface LookupState {
  all: TimezoneOption[]; // sorted east-to-west
  byKey: Map<string, TimezoneOption>;
}

let topState: LookupState | null = null;
let fullState: LookupState | null = null;
let topPromise: Promise<void> | null = null;
let fullPromise: Promise<void> | null = null;
let fullLoadFailed = false;

function currentState(): LookupState | null {
  return fullState || topState;
}

// --- Internal helpers ---

function deref(val: unknown, table: string[]): string {
  return typeof val === "number" ? table[val] : (val as string);
}

function getGmtOffset(timezone: string): number {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      timeZoneName: "shortOffset",
    });
    const parts = formatter.formatToParts(now);
    const offsetPart = parts.find((p) => p.type === "timeZoneName");
    if (offsetPart?.value) {
      const match = offsetPart.value.match(/GMT([+-]?)(\d+)?(?::(\d+))?/);
      if (match) {
        const sign = match[1] === "-" ? -1 : 1;
        const hours = parseInt(match[2] || "0", 10);
        const minutes = parseInt(match[3] || "0", 10);
        return sign * (hours + minutes / 60);
      }
    }
    return 0;
  } catch {
    return 0;
  }
}

function formatGmtLabel(offset: number): string {
  const sign = offset >= 0 ? "+" : "-";
  const absOffset = Math.abs(offset);
  const hours = Math.floor(absOffset);
  const minutes = Math.round((absOffset - hours) * 60);
  if (minutes === 0) {
    return `GMT${sign}${hours}`;
  }
  return `GMT${sign}${hours}:${minutes.toString().padStart(2, "0")}`;
}

function normalizeForKey(ascii: string): string {
  const baseName = ascii.replace(/[^a-zA-Z0-9]/g, "");
  return baseName.charAt(0).toLowerCase() + baseName.slice(1);
}

function buildLookup(raw: { c: string[]; t: string[]; p: string[]; d: unknown[][] }): LookupState {
  const cityMapping: RawCity[] = raw.d.map((r) => ({
    city: r[0] as string,
    city_ascii: r[1] as string,
    lat: r[2] as number,
    lng: r[3] as number,
    pop: r[4] as number,
    country: deref(r[5], raw.c),
    iso2: r[6] as string,
    province: deref(r[7], raw.p),
    state_ansi: r[8] as string,
    timezone: deref(r[9], raw.t),
  }));

  // Generate unique keys: highest-pop city gets the base key (e.g., "oxford_US"),
  // others get province/state appended (e.g., "oxford_US_OH") for disambiguation.
  // Data is already sorted by population descending, so first occurrence = highest pop.
  const usedKeys = new Set<string>();
  const options: TimezoneOption[] = cityMapping.map((city) => {
    const baseKey = `${normalizeForKey(city.city_ascii)}_${city.iso2}`;
    let key = baseKey;
    if (usedKeys.has(key) && (city.state_ansi || city.province)) {
      const suffix = normalizeForKey(city.state_ansi || city.province);
      key = `${baseKey}_${suffix}`;
    }
    if (usedKeys.has(key)) {
      const tzSuffix = city.timezone.split("/").pop()!.replace(/[^a-zA-Z]/g, "");
      key = `${baseKey}_${tzSuffix}`;
    }
    usedKeys.add(key);

    const offset = getGmtOffset(city.timezone);
    return {
      key,
      name: city.city,
      gmtLabel: formatGmtLabel(offset),
      offset,
      timezone: city.timezone,
      country: city.country,
      iso2: city.iso2,
      province: city.province,
      stateAnsi: city.state_ansi || undefined,
      lat: city.lat,
      lng: city.lng,
    };
  });

  const all = options.sort((a, b) => b.offset - a.offset);
  const byKey = new Map<string, TimezoneOption>();
  all.forEach((c) => byKey.set(c.key, c));
  return { all, byKey };
}

// --- Public API ---

/** Load the lightweight top-cities bundle. Statically imported so it lands
 *  in the initial JS payload (≈38 KB) — first search is responsive without
 *  waiting on cities.json. */
export function loadTopCities(): Promise<void> {
  if (topState) return Promise.resolve();
  if (topPromise) return topPromise;

  topPromise = import("@/data/cities-top.json").then((module) => {
    const raw = module.default as { c: string[]; t: string[]; p: string[]; d: unknown[][] };
    topState = buildLookup(raw);
  });

  return topPromise;
}

/** Load the full cities dataset (≈2 MB, ≈30 k cities). Lazy — only call
 *  when the user opens the Add Time Zone dropdown or when idle time allows. */
export function loadCities(): Promise<void> {
  if (fullState) return Promise.resolve();
  if (fullPromise) return fullPromise;

  fullPromise = import("@/data/cities.json")
    .then((module) => {
      const raw = module.default as { c: string[]; t: string[]; p: string[]; d: unknown[][] };
      fullState = buildLookup(raw);
      fullLoadFailed = false;
    })
    .catch((err) => {
      fullLoadFailed = true;
      fullPromise = null; // allow a retry on next invocation
      throw err;
    });

  return fullPromise;
}

/** True if the most recent `loadCities()` attempt rejected. Used to surface
 *  a "Showing top 500 cities — full list unavailable" notice in the UI. */
export function didFullCitiesFail(): boolean {
  return fullLoadFailed;
}

/** True once the full dataset has resolved. */
export function areCitiesLoaded(): boolean {
  return fullState !== null;
}

/** True once either tier is ready — enough to render search results. */
export function areSearchCitiesReady(): boolean {
  return currentState() !== null;
}

/** All cities (prefers full tier, falls back to top). Empty until a tier resolves. */
export function getAllCities(): TimezoneOption[] {
  return currentState()?.all ?? [];
}

export function getCityByKey(key: string): TimezoneOption | undefined {
  return currentState()?.byKey.get(key);
}

export function searchCities(query: string, limit = 50): TimezoneOption[] {
  const state = currentState();
  if (!state) return [];
  const cities = state.all;
  const q = query.toLowerCase().trim();
  if (!q) {
    // Empty query: show the curated featured list (top 20 metro-pop, balanced by region).
    // Defensively drop any keys that don't resolve, so a stale entry can't break the dropdown.
    const featured = FEATURED_CITY_KEYS
      .map((key) => state.byKey.get(key))
      .filter((c): c is TimezoneOption => c !== undefined);
    return featured.slice(0, limit);
  }

  return cities.filter(
    (city) =>
      city.name.toLowerCase().includes(q) ||
      city.country.toLowerCase().includes(q) ||
      city.gmtLabel.toLowerCase().includes(q) ||
      (city.province && city.province.toLowerCase().includes(q))
  ).slice(0, limit);
}

export function getTimeInCityZone(baseTime: Date, offset: number): Date {
  // Convert baseTime to a Date that displays the target timezone's time
  // when using getHours()/getMinutes() in the local environment
  const utcMs = baseTime.getTime();
  const targetMs = utcMs + (offset * 3600000) + (baseTime.getTimezoneOffset() * 60000);
  return new Date(targetMs);
}
