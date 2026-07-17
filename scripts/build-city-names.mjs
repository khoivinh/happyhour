// Regenerates functions/lib/city-names.ts — the key -> city-name map the share-preview Pages
// Function uses to name shared cities. Run after client/src/data/cities-top.json changes:
//   node scripts/build-city-names.mjs
//
// It replays the exact key-generation algorithm from client/src/lib/city-lookup.ts against the
// top-500 tier, so the keys here match the ones the app puts in share URLs. The map is emitted as a
// self-contained TS module (not a JSON import) so the Pages Functions build has no cross-directory
// import and no JSON import attribute to choke on.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const raw = JSON.parse(
  readFileSync(resolve(here, "../client/src/data/cities-top.json"), "utf8")
);

const normalizeForKey = (ascii) => {
  const base = ascii.replace(/[^a-zA-Z0-9]/g, "");
  return base.charAt(0).toLowerCase() + base.slice(1);
};
const deref = (v, table) => (typeof v === "number" ? table[v] : v);

const used = new Set();
const entries = [];
for (const r of raw.d) {
  const name = r[0];
  const cityAscii = r[1];
  const iso2 = r[6];
  const stateAnsi = r[8] || "";
  const province = deref(r[7], raw.p);
  const timezone = deref(r[9], raw.t);

  const baseKey = `${normalizeForKey(cityAscii)}_${iso2}`;
  let key = baseKey;
  if (used.has(key) && (stateAnsi || province)) {
    key = `${baseKey}_${normalizeForKey(stateAnsi || province)}`;
  }
  if (used.has(key)) {
    const tzSuffix = timezone.split("/").pop().replace(/[^a-zA-Z]/g, "");
    key = `${baseKey}_${tzSuffix}`;
  }
  used.add(key);
  entries.push([key, name]);
}

const header = `// GENERATED — do not edit by hand.
//
// key -> display city name for the top-500 tier, used by functions/lib/preview.ts to name shared
// cities in social previews. Regenerate when client/src/data/cities-top.json changes:
//   node scripts/build-city-names.mjs
//
// Kept as a self-contained module inside functions/ on purpose: the Pages Functions build must not
// depend on a JSON import attribute or a cross-directory import into client/.

export const CITY_NAMES: Record<string, string> = {
`;

const body = entries
  .map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`)
  .join("\n");

writeFileSync(resolve(here, "../functions/lib/city-names.ts"), `${header}${body}\n};\n`);
console.log(`wrote functions/lib/city-names.ts with ${entries.length} entries`);
