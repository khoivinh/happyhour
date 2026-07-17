// Pure copy-builder for the social-share preview meta tags injected by `functions/_middleware.ts`.
// Kept free of Cloudflare Worker types so it runs (and unit-tests) in plain Node.
//
// City keys in a share URL (`?z=tokyo_JP,paris_FR`) are generated at runtime by the client's
// `buildLookup` (client/src/lib/city-lookup.ts). CITY_NAMES is a build-time snapshot of that key →
// name mapping for the top-500 tier (see scripts/build-city-names.mjs); keys outside it fall back to
// a plain count. It's a self-contained local module on purpose — the Pages Functions build must not
// depend on a JSON import attribute or a cross-directory import into client/, both of which failed
// the Cloudflare build.
import { CITY_NAMES } from "./city-names";

export interface PreviewMeta {
  title: string;
  description: string;
}

/** Name up to three cities, collapsing the rest — resolved or not — into "& K more".
 *  Falls back to a bare count when nothing resolves (all keys outside the top tier). */
function subjectFor(names: string[], count: number): string {
  if (names.length === 0) return count === 1 ? "1 location" : `${count} locations`;
  const shown = names.slice(0, 3);
  const remaining = count - shown.length;
  if (remaining > 0) return `${shown.join(", ")} & ${remaining} more`;
  if (shown.length === 1) return shown[0];
  return `${shown.slice(0, -1).join(", ")} & ${shown[shown.length - 1]}`;
}

/**
 * Build the per-share OG/Twitter title + description.
 *
 * @param z comma-joined city keys from `?z=` (already URL-decoded by URLSearchParams)
 * @param t the `?t=` value, or null; its presence means a frozen custom-time share
 */
export function buildPreview(z: string, t: string | null): PreviewMeta {
  const keys = z.split(",").map((k) => k.trim()).filter(Boolean);
  const names = keys
    .map((k) => CITY_NAMES[k])
    .filter((n): n is string => Boolean(n));
  const subject = subjectFor(names, keys.length);
  const live = t == null || t === "";

  return live
    ? {
        title: `Current time in ${subject}`,
        description: "Live local times, shared via Happyhour.",
      }
    : {
        title: `Time zone conversion for ${subject}`,
        description: "A time zone conversion, shared via Happyhour.",
      };
}
