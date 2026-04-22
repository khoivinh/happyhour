/** Featured cities — shown as the default list in the Add Cities dropdown
 *  and the per-tile city selector when the search query is empty.
 *  Curated top 20 largest cities by metro population, balanced geographically
 *  so the list isn't dominated by any single region. See PRD "Add Cities →
 *  Default view" (2026-04-22) for the source table and rationale.
 *  Order is east-to-west by current GMT offset, matching the app's existing
 *  sort convention. */
export const FEATURED_CITY_KEYS: readonly string[] = [
  "tokyo_JP",
  "seoul_KR",
  "shanghai_CN",
  "beijing_CN",
  "manila_PH",
  "dhaka_BD",
  "delhi_IN",
  "mumbai_IN",
  "istanbul_TR",
  "moscow_RU",
  "cairo_EG",
  "paris_FR",
  "kinshasa_CD",
  "lagos_NG",
  "london_GB",
  "saoPaulo_BR",
  "buenosAires_AR",
  "newYorkCity_US",
  "mexicoCity_MX",
  "losAngeles_US",
];
