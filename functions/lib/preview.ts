// Pure copy-builder for the social-share preview meta tags injected by `functions/_middleware.ts`.
// Kept free of Cloudflare Worker types so it runs (and unit-tests) in plain Node.
//
// City keys in a share URL (`?z=tokyo_JP,paris_FR`) are generated at runtime by the client's
// `buildLookup` (client/src/lib/city-lookup.ts). We reproduce the same key algorithm here against
// the bundled top-500 tier so the edge can resolve a key back to its city name. The top tier is a
// population-ordered prefix of the full dataset, so the keys it produces are identical to the app's
// for those cities; keys outside it fall back to a plain count.

// The compact columnar bundle: parallel string tables (c/t/p) plus rows `d`, each row an array whose
// columns match RawCity in city-lookup.ts. ~39 KB, bundled into the function at build time.
import citiesTop from "../../client/src/data/cities-top.json" with { type: "json" };

interface RawBundle {
  c: string[];
  t: string[];
  p: string[];
  d: unknown[][];
}

export interface PreviewMeta {
  title: string;
  description: string;
}

/** Mirror of city-lookup.ts `normalizeForKey`: strip to alphanumerics, lowercase the first char. */
function normalizeForKey(ascii: string): string {
  const baseName = ascii.replace(/[^a-zA-Z0-9]/g, "");
  return baseName.charAt(0).toLowerCase() + baseName.slice(1);
}

function deref(val: unknown, table: string[]): string {
  return typeof val === "number" ? table[val] : (val as string);
}

/** Build key → display city-name, replaying the client's collision resolution so keys line up. */
function buildKeyToName(raw: RawBundle): Map<string, string> {
  const used = new Set<string>();
  const map = new Map<string, string>();
  for (const r of raw.d) {
    const name = r[0] as string;
    const cityAscii = r[1] as string;
    const iso2 = r[6] as string;
    const stateAnsi = (r[8] as string) || "";
    const province = deref(r[7], raw.p);
    const timezone = deref(r[9], raw.t);

    const baseKey = `${normalizeForKey(cityAscii)}_${iso2}`;
    let key = baseKey;
    if (used.has(key) && (stateAnsi || province)) {
      key = `${baseKey}_${normalizeForKey(stateAnsi || province)}`;
    }
    if (used.has(key)) {
      const tzSuffix = timezone.split("/").pop()!.replace(/[^a-zA-Z]/g, "");
      key = `${baseKey}_${tzSuffix}`;
    }
    used.add(key);
    // First occurrence wins the base key (highest population), matching the client.
    if (!map.has(key)) map.set(key, name);
  }
  return map;
}

const KEY_TO_NAME = buildKeyToName(citiesTop as unknown as RawBundle);

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
    .map((k) => KEY_TO_NAME.get(k))
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
