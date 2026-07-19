import { useEffect } from "react";
import { SignInButton, useAuth } from "@clerk/clerk-react";
import { CommitBar, CommitBarActions, CommitBarButton } from "@/components/commit-bar";
import { track } from "@/lib/analytics";

/**
 * The account-onboarding nudge: once a signed-out visitor has added a clock, invite them to keep it
 * by creating an account. It's the `CommitBar` primitive in a blue, theme-independent skin (Figma /
 * `2026-07-18-happyhour-account-flow`) — the same bottom-bar chrome and the same Clerk sign-in modal
 * the sidebar already ships, so nothing about the auth path is reinvented here.
 *
 * Whether to show it (added-a-clock-this-session, not yet dismissed, no share flow up) is the
 * parent's call; this component only owns the one thing the parent can't see without a Clerk
 * provider — the signed-in check — and renders nothing once the visitor is authenticated, so
 * signing in from the bar dismisses it for free.
 */
export function RegistrationBar({ onDismiss }: { onDismiss: () => void }) {
  const { isSignedIn } = useAuth();

  useEffect(() => {
    track("registration_prompt_shown");
  }, []);

  if (isSignedIn) return null;

  return (
    // The blue skin lives on this wrapper: it overrides the seven --share-bar-* vars, which cascade
    // into CommitBar's fixed child by DOM ancestry (positioning doesn't break custom-property
    // inheritance). CommitBar itself is untouched — it still just reads the vars.
    <div className="registration-bar">
      <CommitBar testId="registration-bar">
        <p
          className="text-sm font-medium text-[var(--share-bar-fg)]"
          data-testid="text-registration-prompt"
        >
          Save your clocks with a free account
        </p>
        <CommitBarActions>
          <CommitBarButton
            variant="ghost"
            onClick={() => {
              track("registration_prompt_dismissed");
              onDismiss();
            }}
            testId="button-registration-cancel"
          >
            Later
          </CommitBarButton>
          {/* SignInButton clones its child and *composes* the click — it runs the child's own
              onClick, then opens the modal — so this track() fires before sign-in opens. Same
              wrapping the sidebar's "Login or Sign Up" button uses. */}
          <SignInButton mode="modal">
            <CommitBarButton
              variant="primary"
              onClick={() => track("registration_prompt_login_clicked")}
              testId="button-registration-login"
            >
              Login or Sign Up
            </CommitBarButton>
          </SignInButton>
        </CommitBarActions>
      </CommitBar>
    </div>
  );
}
