import { Check } from "lucide-react";

interface ShareSelectionBarProps {
  /** Number of cities that will be shared (selected tiles + local city if included). */
  count: number;
  includeLocal: boolean;
  onToggleIncludeLocal: () => void;
  onCancel: () => void;
  onShare: () => void;
}

/**
 * Fixed bottom action bar for the share select-mode. Aligns to the app's content column
 * and page gutters, floats above the footer, and slides up on enter. The selection count
 * lives only on the Share button (no redundant "N selected"); at 0 the button disables and
 * drops its count.
 *
 * Surface color is per-theme (black in light, yellow in dark, white in happy) via the
 * --share-bar-* tokens, so the bar reads with bold contrast against the page. On mobile the
 * row stacks: the checkbox sits left-aligned on top, the actions below.
 */
export function ShareSelectionBar({
  count,
  includeLocal,
  onToggleIncludeLocal,
  onCancel,
  onShare,
}: ShareSelectionBarProps) {
  const canShare = count > 0;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 px-6 pb-4 md:px-12 lg:px-24">
      <div
        className="mx-auto flex max-w-4xl flex-col items-start gap-3 rounded-[14px] border border-[var(--share-bar-fg)]/10 bg-[var(--share-bar-bg)] px-4 py-3 text-[var(--share-bar-fg)] shadow-[0_-1px_3px_rgba(0,0,0,0.06),0_10px_30px_-10px_rgba(0,0,0,0.35)] animate-in fade-in slide-in-from-bottom-4 duration-200 ease-out motion-reduce:animate-none sm:flex-row sm:items-center sm:justify-between sm:gap-4"
        data-testid="share-selection-bar"
      >
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

        <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-[9px] px-4 py-3 text-sm font-semibold text-[var(--share-bar-muted)] transition-colors hover:text-[var(--share-bar-fg)]"
            data-testid="button-share-cancel"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onShare}
            disabled={!canShare}
            className="rounded-[9px] bg-[var(--share-bar-accent)] px-4 py-3 text-sm font-semibold text-[var(--share-bar-accent-fg)] transition-opacity disabled:opacity-40"
            data-testid="button-share-commit"
          >
            {canShare ? `Share ${count}` : "Share"}
          </button>
        </div>
      </div>
    </div>
  );
}
