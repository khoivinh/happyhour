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
 * drops its count. See the share-flow design gate for the locked spec.
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
        className="mx-auto flex max-w-4xl items-center justify-between gap-4 rounded-[14px] border bg-popover px-4 py-3 text-popover-foreground shadow-[0_-1px_3px_rgba(0,0,0,0.06),0_10px_30px_-10px_rgba(0,0,0,0.25)] animate-in fade-in slide-in-from-bottom-4 duration-200 ease-out motion-reduce:animate-none"
        data-testid="share-selection-bar"
      >
        <button
          type="button"
          onClick={onToggleIncludeLocal}
          className="flex items-center gap-2.5 text-sm font-medium text-foreground"
          aria-pressed={includeLocal}
          data-testid="checkbox-include-local"
        >
          <span
            className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md border-[1.5px] transition-colors ${
              includeLocal
                ? "border-primary bg-primary text-primary-foreground"
                : "border-muted-foreground"
            }`}
          >
            {includeLocal && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
          </span>
          Include my local time
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-[9px] px-4 py-3 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
            data-testid="button-share-cancel"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onShare}
            disabled={!canShare}
            className="rounded-[9px] bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-opacity disabled:opacity-40"
            data-testid="button-share-commit"
          >
            {canShare ? `Share ${count}` : "Share"}
          </button>
        </div>
      </div>
    </div>
  );
}
