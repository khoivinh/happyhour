import cityTimezones from "city-timezones";

export interface CityData {
  city: string;
  country: string;
  timezone: string;
  province?: string;
  lat: number;
  lng: number;
  population?: number;
}

const cityMapping = (cityTimezones as any).cityMapping as Array<{
  city: string;
  city_ascii: string;
  lat: number;
  lng: number;
  pop?: number;
  country: string;
  iso2: string;
  iso3: string;
  province: string;
  state_ansi?: string;
  timezone: string;
}>;

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

// Dedupe by city name + country + timezone (prevent collisions for same-name cities in same country)
const uniqueCities = new Map<string, (typeof cityMapping)[0]>();
cityMapping.forEach((city) => {
  const key = `${city.city_ascii.toLowerCase()}_${city.iso2}_${city.timezone}`;
  const existing = uniqueCities.get(key);
  if (!existing || (city.pop || 0) > (existing.pop || 0)) {
    uniqueCities.set(key, city);
  }
});

const sortedCities = Array.from(uniqueCities.values()).sort((a, b) => {
  return (b.pop || 0) - (a.pop || 0);
});

// Include top 1500 most populous cities for comprehensive worldwide coverage
const popularCities = sortedCities.slice(0, 1500);

export interface TimezoneOption {
  key: string;
  name: string;
  gmtLabel: string;
  offset: number;
  timezone: string;
  country: string;
  iso2: string;
  province?: string;
  lat: number;
  lng: number;
}

// Generate unique key: cityName_countryISO2 (e.g., "paris_FR", "sanJose_US", "sanJose_CR")
function generateCityKey(city: (typeof cityMapping)[0]): string {
  const baseName = city.city_ascii.replace(/[^a-zA-Z0-9]/g, "");
  const normalized = baseName.charAt(0).toLowerCase() + baseName.slice(1);
  return `${normalized}_${city.iso2}`;
}

const timezoneOptions: TimezoneOption[] = popularCities.map((city) => {
  const offset = getGmtOffset(city.timezone);
  return {
    key: generateCityKey(city),
    name: city.city,
    gmtLabel: formatGmtLabel(offset),
    offset,
    timezone: city.timezone,
    country: city.country,
    iso2: city.iso2,
    province: city.province,
    lat: city.lat,
    lng: city.lng,
  };
});

// Keys are now unique by city+country, no collision possible
export const ALL_CITIES: TimezoneOption[] = timezoneOptions.sort(
  (a, b) => b.offset - a.offset
);

const cityByKey = new Map<string, TimezoneOption>();
ALL_CITIES.forEach((city) => cityByKey.set(city.key, city));

export function getCityByKey(key: string): TimezoneOption | undefined {
  return cityByKey.get(key);
}

export function searchCities(query: string, limit = 50): TimezoneOption[] {
  const q = query.toLowerCase().trim();
  if (!q) {
    return ALL_CITIES.slice(0, limit);
  }

  return ALL_CITIES.filter(
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
