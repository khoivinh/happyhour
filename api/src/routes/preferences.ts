import type { Env } from "../index";

interface PreferencesRow {
  user_id: string;
  zones: string;
  use_24h: number;
  sort_etw: number;
  show_rel_time: number;
  show_zone_abbr: number;
  theme: string;
  updated_at: string;
}

interface PreferencesBody {
  zones: string[];
  use24h: boolean;
  sortEastToWest: boolean;
  showRelativeTime: boolean;
  showZoneAbbr: boolean;
  theme: string;
}

const VALID_THEMES = ["light", "dark", "happy", "system"];
const MAX_ZONES = 16;

function rowToJson(row: PreferencesRow) {
  return {
    zones: JSON.parse(row.zones) as string[],
    use24h: row.use_24h === 1,
    sortEastToWest: row.sort_etw === 1,
    showRelativeTime: row.show_rel_time === 1,
    // Legacy rows predating the column read back NULL; default-ON means NULL → true.
    showZoneAbbr: row.show_zone_abbr !== 0,
    theme: row.theme,
    updatedAt: row.updated_at,
  };
}

function validateBody(body: unknown): { valid: true; data: PreferencesBody } | { valid: false; error: string } {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Request body must be a JSON object" };
  }

  const b = body as Record<string, unknown>;

  if (!Array.isArray(b.zones)) {
    return { valid: false, error: "zones must be an array" };
  }
  if (b.zones.length > MAX_ZONES) {
    return { valid: false, error: `zones cannot exceed ${MAX_ZONES} items` };
  }
  if (!b.zones.every((z: unknown) => typeof z === "string")) {
    return { valid: false, error: "zones must be an array of strings" };
  }
  if (typeof b.use24h !== "boolean") {
    return { valid: false, error: "use24h must be a boolean" };
  }
  if (typeof b.sortEastToWest !== "boolean") {
    return { valid: false, error: "sortEastToWest must be a boolean" };
  }
  if (typeof b.showRelativeTime !== "boolean") {
    return { valid: false, error: "showRelativeTime must be a boolean" };
  }
  // Lenient + default-ON: an older client that omits showZoneAbbr still validates, and a missing
  // value becomes true rather than being rejected or silently stored as off.
  if (b.showZoneAbbr !== undefined && typeof b.showZoneAbbr !== "boolean") {
    return { valid: false, error: "showZoneAbbr must be a boolean" };
  }
  if (typeof b.theme !== "string" || !VALID_THEMES.includes(b.theme)) {
    return { valid: false, error: `theme must be one of: ${VALID_THEMES.join(", ")}` };
  }

  return {
    valid: true,
    data: {
      zones: b.zones as string[],
      use24h: b.use24h as boolean,
      sortEastToWest: b.sortEastToWest as boolean,
      showRelativeTime: b.showRelativeTime as boolean,
      showZoneAbbr: b.showZoneAbbr === undefined ? true : (b.showZoneAbbr as boolean),
      theme: b.theme as string,
    },
  };
}

export async function getPreferences(userId: string, env: Env): Promise<Response> {
  const row = await env.DB.prepare(
    "SELECT * FROM user_preferences WHERE user_id = ?"
  )
    .bind(userId)
    .first<PreferencesRow>();

  if (!row) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify(rowToJson(row)), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

export async function putPreferences(userId: string, request: Request, env: Env): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const result = validateBody(body);
  if (!result.valid) {
    return new Response(JSON.stringify({ error: result.error }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { data } = result;
  const now = new Date().toISOString();

  await env.DB.prepare(
    `INSERT OR REPLACE INTO user_preferences (user_id, zones, use_24h, sort_etw, show_rel_time, show_zone_abbr, theme, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      userId,
      JSON.stringify(data.zones),
      data.use24h ? 1 : 0,
      data.sortEastToWest ? 1 : 0,
      data.showRelativeTime ? 1 : 0,
      data.showZoneAbbr ? 1 : 0,
      data.theme,
      now
    )
    .run();

  return new Response(
    JSON.stringify({
      zones: data.zones,
      use24h: data.use24h,
      sortEastToWest: data.sortEastToWest,
      showRelativeTime: data.showRelativeTime,
      showZoneAbbr: data.showZoneAbbr,
      theme: data.theme,
      updatedAt: now,
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
}
