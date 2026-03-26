import { useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "@clerk/clerk-react";
import { fetchPreferences, savePreferences, type CloudPreferences } from "@/lib/api";

export type SyncStatus = "idle" | "syncing" | "synced" | "offline" | "error";

export interface SyncablePreferences {
  zones: string[];
  use24h: boolean;
  sortEastToWest: boolean;
  showRelativeTime: boolean;
  theme: "light" | "dark" | "system";
}

interface UseCloudSyncOptions {
  preferences: SyncablePreferences;
  setPreferences: (prefs: SyncablePreferences) => void;
}

const DEBOUNCE_MS = 1500;
const SYNC_SNAPSHOT_KEY = "world-khlock-sync-snapshot";
const SYNC_TIMESTAMP_KEY = "world-khlock-sync-at";

function cloudToLocal(cloud: Omit<CloudPreferences, "updatedAt">): SyncablePreferences {
  return {
    zones: cloud.zones.slice(0, 16),
    use24h: cloud.use24h,
    sortEastToWest: cloud.sortEastToWest,
    showRelativeTime: cloud.showRelativeTime ?? false,
    theme: cloud.theme,
  };
}

function prefsFingerprint(p: SyncablePreferences): string {
  return `${p.zones.join(",")}|${p.use24h}|${p.sortEastToWest}|${p.showRelativeTime}|${p.theme}`;
}

function saveSyncState(prefs: SyncablePreferences, updatedAt: string) {
  try {
    localStorage.setItem(SYNC_SNAPSHOT_KEY, prefsFingerprint(prefs));
    localStorage.setItem(SYNC_TIMESTAMP_KEY, updatedAt);
  } catch { /* localStorage full — non-critical */ }
}

function hasLocalChanges(current: SyncablePreferences): boolean {
  const snapshot = localStorage.getItem(SYNC_SNAPSHOT_KEY);
  if (!snapshot) return true; // No snapshot = first sync, treat as local changes
  return prefsFingerprint(current) !== snapshot;
}

function getLastSyncTimestamp(): string | null {
  return localStorage.getItem(SYNC_TIMESTAMP_KEY);
}

// Hook that uses Clerk auth — must be called inside ClerkProvider
function useCloudSyncWithAuth({ preferences, setPreferences }: UseCloudSyncOptions): {
  syncStatus: SyncStatus;
} {
  const { getToken, isSignedIn } = useAuth();
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMergingRef = useRef(false);
  const prevSignedInRef = useRef(false);
  const prefsRef = useRef(preferences);
  prefsRef.current = preferences;

  // Initial sync on sign-in
  useEffect(() => {
    if (!isSignedIn || prevSignedInRef.current) {
      prevSignedInRef.current = isSignedIn ?? false;
      if (!isSignedIn) setSyncStatus("idle");
      return;
    }
    prevSignedInRef.current = true;

    let cancelled = false;

    async function initialSync() {
      isMergingRef.current = true;
      setSyncStatus("syncing");

      try {
        const token = await getToken();
        if (!token || cancelled) return;

        const cloud = await fetchPreferences(token);

        if (cancelled) return;

        if (!cloud) {
          // First sync — push local prefs to cloud
          const saved = await savePreferences(token, prefsRef.current);
          saveSyncState(prefsRef.current, saved.updatedAt);
        } else {
          const localChanged = hasLocalChanges(prefsRef.current);

          let winner: SyncablePreferences;
          if (!localChanged) {
            // No local edits since last sync — cloud wins (common case)
            winner = cloudToLocal(cloud);
          } else {
            // Local edits detected (offline changes) — compare timestamps
            const lastSync = getLastSyncTimestamp();
            if (lastSync && lastSync < cloud.updatedAt) {
              // Cloud is newer than our last sync — cloud wins
              winner = cloudToLocal(cloud);
            } else {
              // Local is newer — push to cloud
              winner = prefsRef.current;
            }
          }

          // Only update state if values actually changed — avoids creating
          // a new array reference that would interrupt dnd-kit drag sensors
          const current = prefsRef.current;
          if (prefsFingerprint(winner) !== prefsFingerprint(current)) {
            setPreferences(winner);
          }
          const saved = await savePreferences(token, winner);
          saveSyncState(winner, saved.updatedAt);
        }

        if (!cancelled) setSyncStatus("synced");
      } catch {
        if (!cancelled) setSyncStatus("error");
      } finally {
        isMergingRef.current = false;
      }
    }

    initialSync();

    return () => {
      cancelled = true;
    };
  }, [isSignedIn]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced save on preference changes
  const prefsKey = `${preferences.zones.join(",")}|${preferences.use24h}|${preferences.sortEastToWest}|${preferences.showRelativeTime}|${preferences.theme}`;

  useEffect(() => {
    if (!isSignedIn || isMergingRef.current) return;

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(async () => {
      setSyncStatus("syncing");
      try {
        const token = await getToken();
        if (!token) return;
        const saved = await savePreferences(token, prefsRef.current);
        saveSyncState(prefsRef.current, saved.updatedAt);
        setSyncStatus("synced");
      } catch {
        setSyncStatus("error");
      }
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [isSignedIn, prefsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return { syncStatus };
}

// No-op version when Clerk isn't configured
function useCloudSyncDisabled(): { syncStatus: SyncStatus } {
  return { syncStatus: "idle" };
}

const isClerkConfigured = !!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

// Public hook — delegates based on whether Clerk is configured
export function useCloudSync(options: UseCloudSyncOptions): { syncStatus: SyncStatus } {
  // This conditional is safe because isClerkConfigured is a module-level constant —
  // the branch never changes between renders.
  if (isClerkConfigured) {
    return useCloudSyncWithAuth(options); // eslint-disable-line react-hooks/rules-of-hooks
  }
  return useCloudSyncDisabled();
}
