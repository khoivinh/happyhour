import { Check } from "lucide-react";
import { CommitBar, CommitBarActions, CommitBarButton } from "@/components/commit-bar";

interface ShareSelectionBarProps {
  /** Number of cities that will be shared (selected tiles + local city if included). */
  count: number;
  includeLocal: boolean;
  onToggleIncludeLocal: () => void;
  onCancel: () => void;
  onShare: () => void;
  onCopyLink: () => void;
  /** True for ~3s after a successful copy — swaps the button label to "Copied" instead of a toast. */
  linkCopied: boolean;
  /** Whether this browser can open a native share sheet. Decides whether Share renders at all. */
  canNativeShare: boolean;
}

/**
 * Bottom action bar for the share select-mode. The selection count lives only on the Share button
 * (no redundant "N selected"); at 0 the actions disable and Share drops its count.
 *
 * Copy Link always renders; Share only where `navigator.share` exists. Without a share sheet the
 * Share button had nothing to do but copy to the clipboard, so the two would be one action wearing
 * two buttons — and this can't be decided on screen width, since desktop Chrome and Edge do open a
 * sheet. Where Share is absent, Copy Link takes the primary slot rather than leaving the bar
 * looking like it has nothing to do. It never carries the count: one link is copied whether it
 * holds three cities or ten.
 */
export function ShareSelectionBar({
  count,
  includeLocal,
  onToggleIncludeLocal,
  onCancel,
  onShare,
  onCopyLink,
  linkCopied,
  canNativeShare,
}: ShareSelectionBarProps) {
  const canShare = count > 0;

  return (
    <CommitBar testId="share-selection-bar">
      <button
        type="button"
        onClick={onToggleIncludeLocal}
        className="flex items-center gap-2.5 text-sm font-medium text-[var(--share-bar-fg)]"
        aria-pressed={includeLocal}
        data-testid="checkbox-include-local"
      >
        <span
          className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md border-2 transition-colors ${
            includeLocal
              ? "border-[var(--share-bar-accent)] bg-[var(--share-bar-accent)] text-[var(--share-bar-accent-fg)]"
              : "border-[var(--share-bar-fg)]"
          }`}
        >
          {includeLocal && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
        </span>
        Include my local time
      </button>

      <CommitBarActions>
        <CommitBarButton variant="ghost" onClick={onCancel} testId="button-share-cancel">
          Cancel
        </CommitBarButton>
        <CommitBarButton
          variant={canNativeShare ? "secondary" : "primary"}
          onClick={onCopyLink}
          disabled={!canShare}
          testId="button-share-copy"
        >
          {linkCopied ? "Copied" : "Copy Link"}
        </CommitBarButton>
        {canNativeShare && (
          <CommitBarButton variant="primary" onClick={onShare} disabled={!canShare} testId="button-share-commit">
            {canShare ? `Share ${count}` : "Share"}
          </CommitBarButton>
        )}
      </CommitBarActions>
    </CommitBar>
  );
}
