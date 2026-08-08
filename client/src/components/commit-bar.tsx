import { ComponentPropsWithoutRef, ReactNode, forwardRef, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/** Height of Silktide's cookie banner, or 0 when it isn't up.
 *
 *  The banner is a third-party overlay pinned to the bottom of the viewport at z-index 99999, so it
 *  outranks the bar and we can't reorder it — and out-stacking it isn't an option anyway, since
 *  burying a consent prompt is the one thing that surface must never do. The bar yields instead:
 *  it rides above the banner and drops back down once it's answered.
 *
 *  Watched via the DOM rather than the `silktideConsentManager` global: the vendor exposes no
 *  banner-visibility event, and the DOM is the thing we actually need to measure. The script
 *  injects the banner well after mount and *removes* it on dismiss (verified — it isn't merely
 *  hidden), so the MutationObserver covers both directions; the ResizeObserver catches the banner
 *  reflowing taller on narrow viewports. */
function useConsentBannerHeight() {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    let observed: Element | null = null;
    const read = () => {
      const el = document.getElementById("stcm-banner");
      setHeight(el ? el.getBoundingClientRect().height : 0);
      return el;
    };
    const ro = new ResizeObserver(read);
    const sync = () => {
      const el = read();
      if (el === observed) return;
      if (observed) ro.unobserve(observed);
      if (el) ro.observe(el);
      observed = el;
    };
    sync();
    const mo = new MutationObserver(sync);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      mo.disconnect();
      ro.disconnect();
    };
  }, []);
  return height;
}

/** Reserve space below everything — including the footer, which is a sibling of whichever
 *  component renders the bar — so scrolling to the bottom clears it. Lives here rather than in
 *  the callers because it's a fact about the bar's height, and the Sharing View forgetting it was
 *  exactly how the bar ended up sitting on top of the footer.
 *
 *  `extra` is the consent banner's height: while it's up the bar rides that much higher, so the
 *  page owes that much more room. Re-running on `extra` is safe because React runs the cleanup
 *  before the next effect, so `prev` re-reads the untouched original each time. */
function useCommitBarClearance(bar: HTMLElement | null, extra: number) {
  useEffect(() => {
    const prev = document.body.style.paddingBottom;
    if (!bar) return;
    // Measured, not hardcoded. This used to be a desktop/mobile pair of magic numbers, which stopped
    // being answerable on 2026-08-08: ShareSelectionBar now holds a single row on mobile (~68px)
    // while the Sharing View's and Registration bars still stack (~132px), so no one constant is
    // right for all three. The bar is rendered right here, so measure it — and a ResizeObserver
    // also catches the label reflowing and the `Share 3` -> `Share 16` width change for free.
    const apply = () => {
      // 16px is the wrapper's own pb-4 below the bar; `extra` is the consent banner's height, which
      // the bar rides above while it's up, so the page owes that much more room.
      document.body.style.paddingBottom = `${bar.getBoundingClientRect().height + 16 + extra}px`;
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(bar);
    return () => {
      ro.disconnect();
      document.body.style.paddingBottom = prev;
    };
  }, [bar, extra]);
}

/**
 * The fixed bottom action bar shared by both ends of the share flow: choosing cities to send
 * (`ShareSelectionBar`) and accepting cities someone sent you (`ShareImportBar`).
 *
 * It exists as one component because the two bars are the same object seen from either side, and
 * the surface is load-bearing: it aligns to the app's content column and gutters, floats above the
 * footer, steps up over the cookie banner while that's up, and carries the per-theme
 * `--share-bar-*` skin (black in light, yellow in dark, white in happy). Duplicating that chrome is
 * how the two would quietly diverge.
 *
 * Mounting it reserves the footer clearance; unmounting gives it back.
 *
 * `singleRow` opts out of the mobile stack. It is opt-in rather than the default because only
 * `ShareSelectionBar` can afford it: its left slot is a button, while `ShareImportBar` and
 * `RegistrationBar` put a ~250px sentence there ("Room for 4 more — Happyhour holds 16.") beside
 * labels like "Login or Sign Up". Forcing those onto one row wraps the sentence to three lines and
 * makes the bar *taller*, which is the opposite of the point.
 */
export function CommitBar({
  children,
  testId,
  singleRow = false,
}: {
  children: ReactNode;
  testId?: string;
  singleRow?: boolean;
}) {
  const consentHeight = useConsentBannerHeight();
  const [bar, setBar] = useState<HTMLElement | null>(null);
  useCommitBarClearance(bar, consentHeight);
  return (
    <div
      className="fixed inset-x-0 z-50 px-6 pb-4 transition-[bottom] duration-200 ease-out motion-reduce:transition-none md:px-12 lg:px-24"
      style={{ bottom: consentHeight }}
      data-consent-offset={consentHeight || undefined}
    >
      <div
        ref={setBar}
        className={cn(
          "mx-auto flex max-w-4xl rounded-[14px] border border-[color:var(--share-bar-border)] bg-[var(--share-bar-bg)] py-3 text-[var(--share-bar-fg)] shadow-[0_-1px_3px_rgba(0,0,0,0.06),0_10px_30px_-10px_rgba(0,0,0,0.35)] animate-in fade-in slide-in-from-bottom-4 duration-200 ease-out motion-reduce:animate-none sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-4",
          // Tighter gutter below sm in single-row mode: the four controls need every pixel at 390px.
          singleRow
            ? "flex-row items-center justify-between gap-2 px-3"
            : "flex-col items-start gap-3 px-4"
        )}
        data-testid={testId}
        data-single-row={singleRow || undefined}
      >
        {children}
      </div>
    </div>
  );
}

/** Right-hand action cluster. Full width on mobile so the buttons reach the bar's edges — except in
 *  `singleRow` mode, where claiming the full width would shove the left slot off the bar. */
export function CommitBarActions({
  children,
  singleRow = false,
}: {
  children: ReactNode;
  singleRow?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-end gap-2 sm:w-auto",
        singleRow ? "w-auto" : "w-full"
      )}
    >
      {children}
    </div>
  );
}

/** Three tiers of emphasis, so the rightmost filled pill is always *the* action:
 *  - ghost:     the way out (Done). Label only.
 *  - secondary: a real action, but not the one (Copy Link, when Share is also present).
 *  - primary:   the bar's reason for existing.
 *  Copy Link moves between secondary and primary depending on whether Share renders beside it —
 *  a bar whose only action is styled as an also-ran reads as having nothing to do. */
type Variant = "ghost" | "secondary" | "primary";

const VARIANTS: Record<Variant, string> = {
  ghost: "text-[var(--share-bar-muted)] hover:text-[var(--share-bar-fg)]",
  secondary: "bg-[var(--share-bar-subtle)] text-[var(--share-bar-fg)] hover:opacity-80",
  primary: "bg-[var(--share-bar-accent)] text-[var(--share-bar-accent-fg)]",
};

/** Forwards its ref and spreads the rest so a Radix `asChild` trigger can drive it — that's how the
 *  Sharing Options popover gets Copy Link's exact gray by construction instead of by copied hex. */
export const CommitBarButton = forwardRef<
  HTMLButtonElement,
  {
    variant: Variant;
    onClick?: () => void;
    disabled?: boolean;
    children: ReactNode;
    testId?: string;
    className?: string;
  } & Omit<ComponentPropsWithoutRef<"button">, "onClick" | "disabled" | "children" | "className">
>(({ variant, onClick, disabled, children, testId, className, ...rest }, ref) => {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        // px-3 below sm, px-4 above: four controls don't fit a 390px row at the wider padding, and
        // the 8px per button is the cheapest place to find the space. Vertical padding is untouched,
        // so every button stays exactly 44px tall at both breakpoints.
        // whitespace-nowrap: without it a cramped row silently breaks "Copy Link" across two lines
        // and grows the pill to 60px instead of overflowing, which hides the problem rather than
        // showing it.
        "flex items-center justify-center whitespace-nowrap rounded-[9px] px-3 py-3 text-sm font-semibold transition-colors disabled:opacity-40 sm:px-4",
        VARIANTS[variant],
        className
      )}
      data-testid={testId}
      {...rest}
    >
      {children}
    </button>
  );
});
CommitBarButton.displayName = "CommitBarButton";
