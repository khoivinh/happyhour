import { CommitBar, CommitBarActions, CommitBarButton } from "@/components/commit-bar";
import { SharingOptionsPopover, type ShareOptions } from "@/components/sharing-options-popover";

interface ShareSelectionBarProps {
  /** Number of cities that will be shared (selected tiles + local city if included). */
  count: number;
  /** The three settings that govern the message — 12/24-hour, zone names, and whether the
   *  happyhour.day link rides along. Independent of the Sidebar's same-named view preferences. */
  shareOptions: ShareOptions;
  onChangeShareOptions: (patch: Partial<ShareOptions>) => void;
  /** Lifted so the page can tell whether Escape should close the popover or leave share mode. */
  optionsOpen: boolean;
  onOptionsOpenChange: (open: boolean) => void;
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
  shareOptions,
  onChangeShareOptions,
  optionsOpen,
  onOptionsOpenChange,
  onCancel,
  onShare,
  onCopyLink,
  linkCopied,
  canNativeShare,
}: ShareSelectionBarProps) {
  const canShare = count > 0;

  return (
    <CommitBar testId="share-selection-bar">
      {/* Replaced the lone "Include Happyhour link" checkbox (2026-08-08). That checkbox governed
          one of three things that shape a share; the other two were being read off the Sidebar,
          where they describe the user's own board instead. */}
      <SharingOptionsPopover
        open={optionsOpen}
        onOpenChange={onOptionsOpenChange}
        options={shareOptions}
        onChange={onChangeShareOptions}
      />

      <CommitBarActions>
        {/* Reads "Done", not "Cancel": leaving select-mode keeps the board exactly as it was, so
            there is nothing to cancel. The testId keeps its original name. */}
        <CommitBarButton variant="ghost" onClick={onCancel} testId="button-share-cancel">
          Done
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
