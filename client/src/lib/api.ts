const API_URL = import.meta.env.VITE_API_URL || "";

export interface CloudPreferences {
  zones: string[];
  use24h: boolean;
  sortEastToWest: boolean;
  showRelativeTime: boolean;
  /** Optional so records saved before this preference existed still typecheck; a missing value
   *  resolves to the default-ON true in cloudToLocal, never silently to false. */
  showZoneAbbr?: boolean;
  theme: "dark" | "light" | "happy" | "system";
  updatedAt: string;
}

export async function fetchPreferences(token: string): Promise<CloudPreferences | null> {
  const res = await fetch(`${API_URL}/api/preferences`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function savePreferences(
  token: string,
  prefs: Omit<CloudPreferences, "updatedAt">
): Promise<CloudPreferences> {
  const res = await fetch(`${API_URL}/api/preferences`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(prefs),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function deleteAccount(token: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/account`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
}
