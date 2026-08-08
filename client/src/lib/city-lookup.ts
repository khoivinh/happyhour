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
  /** Lowercased, diacritic-stripped city name used for search matching
   *  (so typing "sao" finds "São Paulo"). Sourced from the raw dataset's
   *  `city_ascii` field. */
  nameAscii: string;
  gmtLabel: string;
  offset: number;
  timezone: string;
  country: string;
  iso2: string;
  province?: string;
  stateAnsi?: string;
  lat: number;
  lng: number;
  /** Original index in the population-sorted raw dataset (0 = most populous).
   *  Used as a relevance tiebreaker in `searchCities` so that e.g. "san francisco"
   *  returns San Francisco, CA before smaller same-named cities. */
  rank: number;
}

/** Normalize a string for search: lowercase + strip Unicode combining marks.
 *  NFD decomposes accented characters into base + combining mark; the regex
 *  drops the marks, leaving "São Paulo" → "sao paulo". */
function fold(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
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

/** A zone's UTC offset (hours) at a specific instant, via the same Intl shortOffset parse as
 *  getGmtOffset but for an arbitrary date — lets us compare winter vs summer to detect DST. */
function offsetAt(timezone: string, date: Date): number {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      timeZoneName: "shortOffset",
    }).formatToParts(date);
    const value = parts.find((p) => p.type === "timeZoneName")?.value;
    const match = value?.match(/GMT([+-]?)(\d+)?(?::(\d+))?/);
    if (match) {
      const sign = match[1] === "-" ? -1 : 1;
      return sign * (parseInt(match[2] || "0", 10) + parseInt(match[3] || "0", 10) / 60);
    }
  } catch { /* fall through to 0 */ }
  return 0;
}

/** Curated IANA-zone → abbreviation map for zones the browser does NOT abbreviate: Intl's "short"
 *  format returns real letters (EST, PDT) only for North-American zones and falls back to "GMT+2"
 *  for most of the world, so CET/JST/etc. must come from here. US/Canada zones are intentionally
 *  absent — the Intl fallback in getZoneAbbreviation already handles them. `dst` is the
 *  daylight/summer form; which one is shown is decided from the live offset, never hardcoded, so
 *  entries survive DST-rule changes. Some abbreviations are inherently ambiguous (CST = China and
 *  US Central; IST = India and Israel) — accepted tradeoff of showing names by default. */
const ZONE_ABBR: Record<string, { std: string; dst?: string }> = {
  // Europe
  "Europe/London": { std: "GMT", dst: "BST" },
  "Europe/Dublin": { std: "GMT", dst: "IST" },
  "Europe/Lisbon": { std: "WET", dst: "WEST" },
  "Europe/Paris": { std: "CET", dst: "CEST" },
  "Europe/Berlin": { std: "CET", dst: "CEST" },
  "Europe/Madrid": { std: "CET", dst: "CEST" },
  "Europe/Rome": { std: "CET", dst: "CEST" },
  "Europe/Amsterdam": { std: "CET", dst: "CEST" },
  "Europe/Brussels": { std: "CET", dst: "CEST" },
  "Europe/Zurich": { std: "CET", dst: "CEST" },
  "Europe/Vienna": { std: "CET", dst: "CEST" },
  "Europe/Warsaw": { std: "CET", dst: "CEST" },
  "Europe/Stockholm": { std: "CET", dst: "CEST" },
  "Europe/Prague": { std: "CET", dst: "CEST" },
  "Europe/Budapest": { std: "CET", dst: "CEST" },
  "Europe/Copenhagen": { std: "CET", dst: "CEST" },
  "Europe/Oslo": { std: "CET", dst: "CEST" },
  "Europe/Athens": { std: "EET", dst: "EEST" },
  "Europe/Helsinki": { std: "EET", dst: "EEST" },
  "Europe/Bucharest": { std: "EET", dst: "EEST" },
  "Europe/Kiev": { std: "EET", dst: "EEST" },
  "Europe/Istanbul": { std: "TRT" },
  "Europe/Moscow": { std: "MSK" },
  // Asia
  "Asia/Tokyo": { std: "JST" },
  "Asia/Seoul": { std: "KST" },
  "Asia/Shanghai": { std: "CST" },
  "Asia/Hong_Kong": { std: "HKT" },
  "Asia/Taipei": { std: "CST" },
  "Asia/Singapore": { std: "SGT" },
  "Asia/Kuala_Lumpur": { std: "MYT" },
  "Asia/Bangkok": { std: "ICT" },
  "Asia/Jakarta": { std: "WIB" },
  "Asia/Manila": { std: "PHT" },
  "Asia/Kolkata": { std: "IST" },
  "Asia/Karachi": { std: "PKT" },
  "Asia/Dubai": { std: "GST" },
  "Asia/Riyadh": { std: "AST" },
  "Asia/Tehran": { std: "IRST" },
  "Asia/Jerusalem": { std: "IST", dst: "IDT" },
  // Oceania
  "Australia/Sydney": { std: "AEST", dst: "AEDT" },
  "Australia/Brisbane": { std: "AEST" },
  "Australia/Adelaide": { std: "ACST", dst: "ACDT" },
  "Australia/Darwin": { std: "ACST" },
  "Australia/Perth": { std: "AWST" },
  "Pacific/Auckland": { std: "NZST", dst: "NZDT" },
};

/** The zone's named abbreviation to show in place of the GMT label, or null if none is known
 *  (the caller then keeps "GMT+X"). Curated table first — picking std vs dst from the live offset —
 *  then Intl "short" for the North-American zones it does abbreviate, then null. */
export function getZoneAbbreviation(timezone: string): string | null {
  const entry = ZONE_ABBR[timezone];
  if (entry) {
    if (!entry.dst) return entry.std;
    // DST always shifts the clock forward (larger UTC offset). Compare the live offset against the
    // year's standard (winter) offset; min() picks standard in either hemisphere, so no north/south
    // special-casing — a southern zone in its summer is correctly detected as DST.
    const now = new Date();
    const year = now.getFullYear();
    const stdOffset = Math.min(offsetAt(timezone, new Date(year, 0, 1)), offsetAt(timezone, new Date(year, 6, 1)));
    return offsetAt(timezone, now) > stdOffset ? entry.dst : entry.std;
  }
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      timeZoneName: "short",
    }).formatToParts(new Date());
    const value = parts.find((p) => p.type === "timeZoneName")?.value;
    // Intl returns "GMT+2"/"UTC" for zones it can't abbreviate — reject those, keep real letters.
    if (value && !/^(GMT|UTC)/.test(value)) return value;
  } catch { /* ignore */ }
  return null;
}

/** Three-letter names for cities in *shared message text only* — never on the tiles, which always
 *  show the full name. A shared message is scanned in a chat thread, where "8:00 AM EDT NYC" carries
 *  further than the full string; the board is read deliberately, where it doesn't.
 *
 *  Curated, and deliberately partial — 168 of 30,481 cities. Anything absent keeps its full name via
 *  the `??` in `shareCityName`, so an omission costs nothing and a bad guess costs a lot. The rules,
 *  in priority order (see docs/2026-08-08-devlog.md and the Obsidian list it was reviewed in):
 *
 *    1. Intuitive beats official. TOR for Toronto, never YYZ — but LAX, SFO and PHL are fine,
 *       because those codes already read as their cities.
 *    2. Prefer the name's own first three letters where unambiguous.
 *    3. Airport/IATA codes only where already read as the city. Never opaque ones (SCL, BOM, MAA).
 *    4. Established civilian shorthand beats both: NYC, RIO, BKK, CPH, TLV.
 *    5. Exactly three characters, so LA -> LAX and HK -> HKG.
 *    6. Contested forms go to nobody. Chennai and Chengdu both want CHE and neither is decisive, so
 *       neither is listed; same for Shenzhen/Shenyang on SHE.
 *    7. No abbreviation beats a bad one — most Chinese and Indian tier-2 cities have no intuitive
 *       reduction for a non-local reader, and are absent on purpose.
 *
 *  Keyed by city key, not display name: the dataset stores "New York City", and five different
 *  cities are called "Washington". Note too that several cities are stored — and shown on the
 *  tiles — under local names (Zürich, Genève, Köln, Montréal). An abbreviation has to read against
 *  the label the user actually sees, which is why Köln is absent (COL derives from "Cologne", a
 *  string that never appears on screen, and KOL is Kolkata's) while Genève keeps GVA. */
const CITY_ABBR: Record<string, string> = {
  // United States
  newYorkCity_US:            "NYC",
  losAngeles_US:             "LAX",
  chicago_US:                "CHI",
  sanFrancisco_US:           "SFO",
  washington_US:             "WDC",
  boston_US:                 "BOS",
  seattle_US:                "SEA",
  miami_US:                  "MIA",
  atlanta_US:                "ATL",
  denver_US:                 "DEN",
  dallas_US:                 "DAL",
  houston_US:                "HOU",
  austin_US:                 "AUS",
  philadelphia_US:           "PHL",
  phoenix_US:                "PHX",
  lasVegas_US:               "LAS",
  sanDiego_US:               "SAN",
  portland_US:               "PDX",
  detroit_US:                "DET",
  honolulu_US:               "HNL",
  saltLakeCity_US:           "SLC",
  minneapolis_US:            "MSP",
  newOrleans_US:             "NOL",
  nashville_US:              "NSH",
  sanJose_US:                "SJC",
  // Canada
  toronto_CA:                "TOR",
  vancouver_CA:              "VAN",
  montreal_CA:               "MTL",  // Montréal
  calgary_CA:                "CAL",
  ottawa_CA:                 "OTT",
  // Latin America
  mexicoCity_MX:             "MEX",
  guadalajara_MX:            "GDL",
  monterrey_MX:              "MTY",
  saoPaulo_BR:               "SAO",  // São Paulo
  riodeJaneiro_BR:           "RIO",
  brasilia_BR:               "BSB",  // Brasília
  buenosAires_AR:            "BUE",
  santiago_CL:               "SGO",
  lima_PE:                   "LIM",
  bogota_CO:                 "BOG",  // Bogotá
  medellin_CO:               "MDE",  // Medellín
  caracas_VE:                "CCS",
  quito_EC:                  "QUI",
  havana_CU:                 "HAV",
  panama_PA:                 "PAN",  // Panamá
  guatemalaCity_GT:          "GUA",
  montevideo_UY:             "MVD",
  // Europe
  london_GB:                 "LON",
  paris_FR:                  "PAR",
  berlin_DE:                 "BER",
  madrid_ES:                 "MAD",
  barcelona_ES:              "BCN",
  rome_IT:                   "ROM",
  milan_IT:                  "MIL",
  naples_IT:                 "NAP",
  amsterdam_NL:              "AMS",
  rotterdam_NL:              "ROT",
  brussels_BE:               "BRU",
  antwerpen_BE:              "ANT",
  zuerich_CH:                "ZUR",  // Zürich
  geneve_CH:                 "GVA",  // Genève
  munich_DE:                 "MUN",
  frankfurtamMain_DE:        "FRA",
  hamburg_DE:                "HAM",
  duesseldorf_DE:            "DUS",  // Düsseldorf
  vienna_AT:                 "VIE",
  dublin_IE:                 "DUB",
  edinburgh_GB:              "EDI",
  glasgow_GB:                "GLA",
  manchester_GB:             "MAN",
  lisbon_PT:                 "LIS",
  porto_PT:                  "POR",
  sevilla_ES:                "SEV",
  valencia_ES:               "VLC",
  marseille_FR:              "MRS",
  nice_FR:                   "NCE",
  stockholm_SE:              "STO",
  goeteborg_SE:              "GOT",  // Göteborg
  copenhagen_DK:             "CPH",
  oslo_NO:                   "OSL",
  helsinki_FI:               "HEL",
  reykjavik_IS:              "REY",  // Reykjavík
  warsaw_PL:                 "WAW",
  prague_CZ:                 "PRG",
  budapest_HU:               "BUD",
  bucharest_RO:              "BUC",
  belgrade_RS:               "BEL",
  athens_GR:                 "ATH",
  istanbul_TR:               "IST",
  moscow_RU:                 "MOS",
  saintPetersburg_RU:        "SPB",
  kyiv_UA:                   "KYI",
  luxembourg_LU:             "LUX",
  // Middle East & Africa
  dubai_AE:                  "DXB",
  abuDhabi_AE:               "ABU",
  doha_QA:                   "DOH",
  riyadh_SA:                 "RIY",
  jeddah_SA:                 "JED",
  telAviv_IL:                "TLV",
  jerusalem_IL:              "JER",
  beirut_LB:                 "BEY",
  amman_JO:                  "AMM",
  kuwaitCity_KW:             "KUW",
  muscat_OM:                 "MUS",
  tehran_IR:                 "TEH",
  baghdad_IQ:                "BAG",
  cairo_EG:                  "CAI",
  casablanca_MA:             "CAS",
  marrakesh_MA:              "MAR",
  algiers_DZ:                "ALG",
  tunis_TN:                  "TUN",
  lagos_NG:                  "LAG",
  nairobi_KE:                "NAI",
  johannesburg_ZA:           "JNB",
  capeTown_ZA:               "CPT",
  accra_GH:                  "ACC",
  dakar_SN:                  "DAK",
  addisAbaba_ET:             "ADD",
  kinshasa_CD:               "KIN",
  // Asia
  tokyo_JP:                  "TOK",
  osaka_JP:                  "OSA",
  kyoto_JP:                  "KYO",
  nagoya_JP:                 "NAG",
  sapporo_JP:                "SAP",
  fukuoka_JP:                "FUK",
  yokohama_JP:               "YOK",
  seoul_KR:                  "SEO",
  busan_KR:                  "BUS",
  beijing_CN:                "BEI",
  shanghai_CN:               "SHA",
  hongKong_HK:               "HKG",
  taipei_TW:                 "TPE",
  singapore_SG:              "SIN",
  bangkok_TH:                "BKK",
  jakarta_ID:                "JKT",
  kualaLumpur_MY:            "KUL",
  manila_PH:                 "MNL",
  hoChiMinhCity_VN:          "HCM",
  hanoi_VN:                  "HAN",
  phnomPenh_KH:              "PNH",
  yangon_MM:                 "YAN",
  delhi_IN:                  "DEL",
  mumbai_IN:                 "MUM",
  bengaluru_IN:              "BLR",
  kolkata_IN:                "KOL",
  hyderabad_IN:              "HYD",
  pune_IN:                   "PUN",
  ahmedabad_IN:              "AHM",
  karachi_PK:                "KAR",
  lahore_PK:                 "LAH",
  islamabad_PK:              "ISB",
  dhaka_BD:                  "DHA",
  colombo_LK:                "CMB",
  kathmandu_NP:              "KTM",
  almaty_KZ:                 "ALA",
  tashkent_UZ:               "TAS",
  baku_AZ:                   "BAK",
  tbilisi_GE:                "TBS",
  ulanBator_MN:              "ULA",
  kabul_AF:                  "KAB",
  // Oceania
  sydney_AU:                 "SYD",
  melbourne_AU:              "MEL",
  brisbane_AU:               "BRI",
  perth_AU:                  "PER",
  adelaide_AU:               "ADL",
  auckland_NZ:               "AUC",
  wellington_NZ:             "WEL",
  christchurch_NZ:           "CHC",
};

/** The name a city goes by in a shared message: its curated three-letter form, or its full name.
 *  Share text only — the tiles and the OG preview card (`functions/lib/preview.ts`) both keep full
 *  names, the card because a link-preview headline has room and clarity there is worth more than
 *  brevity. */
export function shareCityName(city: TimezoneOption): string {
  return CITY_ABBR[city.key] ?? city.name;
}

/** The tile meta-line label: the zone abbreviation when "Time Zone Names" is on and one exists,
 *  else the GMT-offset label. Keeps the three tile call sites from repeating the fallback. */
export function zoneLabel(city: TimezoneOption, showZoneAbbr: boolean): string {
  if (!showZoneAbbr) return city.gmtLabel;
  return getZoneAbbreviation(city.timezone) ?? city.gmtLabel;
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
  const options: TimezoneOption[] = cityMapping.map((city, idx) => {
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
      nameAscii: city.city_ascii.toLowerCase(),
      gmtLabel: formatGmtLabel(offset),
      offset,
      timezone: city.timezone,
      country: city.country,
      iso2: city.iso2,
      province: city.province,
      stateAnsi: city.state_ansi || undefined,
      lat: city.lat,
      lng: city.lng,
      rank: idx,
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
  const rawQuery = query.trim();
  if (!rawQuery) {
    // Empty query: show the curated featured list (top 20 metro-pop, balanced by region).
    // Defensively drop any keys that don't resolve, so a stale entry can't break the dropdown.
    const featured = FEATURED_CITY_KEYS
      .map((key) => state.byKey.get(key))
      .filter((c): c is TimezoneOption => c !== undefined);
    return featured.slice(0, limit);
  }

  // Fold query for diacritic-insensitive matching. `nameAscii` is already folded
  // at build time; country/province are folded on the fly (only evaluated when
  // the name didn't match, bounding the cost).
  const q = fold(rawQuery);

  // Score each city; higher score = stronger match. Tiebreak by population rank
  // ascending so the most-populous match wins (e.g. SF California over SF Philippines).
  //   4 — exact name match
  //   3 — name starts with query
  //   2 — name contains query (substring)
  //   1 — country / province / GMT label contains query
  const scored: { city: TimezoneOption; score: number }[] = [];
  for (const city of cities) {
    let score = 0;
    const name = city.nameAscii;
    if (name === q) {
      score = 4;
    } else if (name.startsWith(q)) {
      score = 3;
    } else if (name.includes(q)) {
      score = 2;
    } else {
      const country = fold(city.country);
      const province = city.province ? fold(city.province) : "";
      const gmt = city.gmtLabel.toLowerCase();
      if (country.includes(q) || province.includes(q) || gmt.includes(q)) {
        score = 1;
      }
    }
    if (score > 0) scored.push({ city, score });
  }

  scored.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    return a.city.rank - b.city.rank;
  });

  return scored.slice(0, limit).map((r) => r.city);
}

export function getTimeInCityZone(baseTime: Date, offset: number): Date {
  // Convert baseTime to a Date that displays the target timezone's time
  // when using getHours()/getMinutes() in the local environment
  const utcMs = baseTime.getTime();
  const targetMs = utcMs + (offset * 3600000) + (baseTime.getTimezoneOffset() * 60000);
  return new Date(targetMs);
}
