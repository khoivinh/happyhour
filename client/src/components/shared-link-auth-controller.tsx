import { useEffect, useRef } from "react";
import { useAuth, useUser } from "@clerk/clerk-react";
import { SharedLinkView } from "@/components/shared-link-view";

/** How recently an account must have been created to count as "just registered from this view."
 *  Generous on purpose — the alternative (a fragile sign-up vs sign-in signal from Clerk's modal)
 *  doesn't exist, and the failure mode is benign: a returning user who happens to have registered
 *  in the last couple of minutes would simply get their shared clocks auto-added. */
const NEW_ACCOUNT_WINDOW_MS = 2 * 60 * 1000;

interface SharedLinkAuthControllerProps {
  keys: string[];
  t: number | null;
  ownedKeys: string[];
  use24Hour: boolean;
  showZoneAbbr: boolean;
  onAdd: (keys: string[]) => void;
  onDismiss?: () => void;
}

/**
 * The Clerk-aware wrapper around the Sharing View. It exists only so that all Clerk hook usage stays
 * behind the `isClerkConfigured` gate in world-clock — the no-Clerk test/CI build mounts the plain
 * `SharedLinkView` (Commit Bar) instead and never renders this, which is what keeps the existing
 * share tests green.
 *
 * Two jobs:
 *  - Decide the mode: a signed-out recipient gets `registerMode` (Registration Bar, checkless tiles);
 *    a signed-in one gets the normal Commit Bar. Loading resolves to register mode, since the common
 *    recipient is signed-out — an already-signed-in user just sees checks appear a beat later.
 *  - On the genuine sign-in edge (not an already-signed-in open), branch on account age: a brand-new
 *    registrant has every shared clock auto-added and is taken to the board (via `onAdd`); a
 *    returning user is left in place, where the now-false `registerMode` reveals the Commit Bar.
 */
export function SharedLinkAuthController({ keys, t, ownedKeys, use24Hour, showZoneAbbr, onAdd, onDismiss }: SharedLinkAuthControllerProps) {
  const { isSignedIn, isLoaded } = useAuth();
  const { user } = useUser();
  const registerMode = !isSignedIn;

  // Baseline-latched so opening the share while ALREADY signed in is never mistaken for a fresh
  // registration: on the first resolved render we just record the current state; only a later
  // false→true flip counts as "registered/logged in from this view." Mirrors the ref-latch in
  // use-cloud-sync.ts.
  const latch = useRef({ initialized: false, prev: false });
  useEffect(() => {
    if (!isLoaded) return; // wait for Clerk to resolve before trusting isSignedIn
    const signedIn = !!isSignedIn;
    if (!latch.current.initialized) {
      latch.current = { initialized: true, prev: signedIn };
      return;
    }
    if (signedIn && !latch.current.prev && user) {
      latch.current.prev = true;
      const justRegistered =
        !!user.createdAt && Date.now() - user.createdAt.getTime() < NEW_ACCOUNT_WINDOW_MS;
      if (justRegistered) onAdd(keys); // new account → auto-add all → board + highlight
      // returning user → no-op; registerMode is now false, so the Commit Bar takes over
      return;
    }
    latch.current.prev = signedIn;
  }, [isLoaded, isSignedIn, user, onAdd, keys]);

  return (
    <SharedLinkView
      keys={keys}
      t={t}
      ownedKeys={ownedKeys}
      use24Hour={use24Hour}
      showZoneAbbr={showZoneAbbr}
      onAdd={onAdd}
      onDismiss={onDismiss}
      registerMode={registerMode}
    />
  );
}
