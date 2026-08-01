import {
  getCityByKey,
  getTimeInCityZone,
  getZoneAbbreviation,
  type TimezoneOption,
} from "@/lib/city-lookup";

/**
 * The human-readable half of a share. A link alone says nothing until it's opened; this rides
 * alongside it so the times are legible in the message itself — in a chat thread, an email, or a
 * notification preview that never renders the OG card.
 *
 * Two shapes, matching the two kinds of share:
 *   custom  "New York City 3:00 PM/Paris 9:00 PM/Bengaluru 12:30 AM"
 *   live    "Current time in New York City 3:00 PM EDT GMT-4/Paris 9:00 PM CEST GMT+2"
 *
 * A custom share is a conversion — the instant is fixed and the zones are implied by the cities,
 * so naming them would be noise. A live share is a snapshot of *now*, where the zone tells the
 * reader how stale the number is by the time they read it.
 */

/** Separator between cities. Slashes, not commas — city names contain commas. */
const SEP = "/";

/** Clock face for one city, in the reader's own 12/24-hour preference. Mirrors the tile exactly
 *  (`digital-clock.tsx`): 24-hour pads the hour, 12-hour doesn't and carries AM/PM. */
function formatClock(d: Date, use24Hour: boolean): string {
  const rawHours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, "0");
  if (use24Hour) return `${rawHours.toString().padStart(2, "0")}:${minutes}`;
  const h12 = rawHours % 12 || 12;
  return `${h12}:${minutes} ${rawHours >= 12 ? "PM" : "AM"}`;
}

/** Zone identification for the live form: abbreviation *and* offset where an abbreviation is
 *  known ("EDT GMT-4"), the offset alone otherwise. Only ~40 zones have a curated abbreviation, so
 *  the fallback is the common case, not the exception — and it must not read "GMT+7 GMT+7". */
function zoneSuffix(city: TimezoneOption): string {
  const abbr = getZoneAbbreviation(city.timezone);
  return abbr ? `${abbr} ${city.gmtLabel}` : city.gmtLabel;
}

export interface ShareTextOptions {
  /** The reader's 12/24-hour preference, same flag the tiles use. */
  use24Hour: boolean;
  /** The frozen instant for a custom-time share, or null for a live one. */
  customTime: Date | null;
  /** "Now" for a live share. Injected rather than read from the clock so the output is testable. */
  now?: Date;
}

/**
 * Build the share text for a set of city keys.
 *
 * `keys` is used in the order given — callers pass the already-sorted east-to-west share set, so
 * this doesn't re-sort and the text matches the link's tile order. Keys with no city (a stale or
 * hand-edited link) are dropped rather than rendered as a gap; an empty result yields "".
 *
 * Uses each zone's *current* offset, so a custom instant far from today could name a zone by
 * today's DST state — the same edge case the east-to-west sort carries, and deliberately left
 * alone here too.
 */
export function buildShareText(keys: string[], opts: ShareTextOptions): string {
  const { use24Hour, customTime } = opts;
  const baseTime = customTime ?? opts.now ?? new Date();
  const live = customTime == null;

  const cities = keys
    .map((key) => getCityByKey(key))
    .filter((city): city is TimezoneOption => city != null);

  if (cities.length === 0) return "";

  const segments = cities.map((city) => {
    const clock = formatClock(getTimeInCityZone(baseTime, city.offset), use24Hour);
    return live ? `${city.name} ${clock} ${zoneSuffix(city)}` : `${city.name} ${clock}`;
  });

  const body = segments.join(SEP);
  return live ? `Current time in ${body}` : body;
}

/**
 * The full share payload: the text, then the link on its own line.
 *
 * One function so the share sheet and Copy Link can't drift apart — a link copied to the clipboard
 * should paste as the same thing the sheet would have sent.
 */
export function buildSharePayload(text: string, url: string): string {
  return text ? `${text}\n${url}` : url;
}
