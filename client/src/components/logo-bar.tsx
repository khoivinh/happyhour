import { HappyhourLogo } from "@/components/icons/happyhour-logo";
import { HappyhourWordmark } from "@/components/icons/happyhour-wordmark";
import { useTheme } from "@/lib/theme-provider";

/** The logo bar, shared by the home page and every content page.
 *
 *  This exists as a component — rather than the same markup copy-pasted into three files — because its
 *  top padding is load-bearing and must not drift. `pt-[23px]` plus the nameplate's `pt-[9px]` puts the
 *  wordmark's ink top at 32px: the same y as the pinned drawer icon, and as the hero's city name once
 *  it goes sticky. Home and the content pages have to share that value or navigating between them makes
 *  the logo jump. That parity has silently broken twice (2026-04-25, then again on 2026-07-14) while it
 *  was a duplicated literal guarded only by a comment promising the files agreed. A comment is not a
 *  mechanism; one definition is.
 *
 *  On the dashboard it's deliberately not sticky: it scrolls away off the top, leaving the hero
 *  clock's rule as the only one at the top of the viewport (Figma 329:3241). The Sharing View has no
 *  hero to take over as the pinned element, so there it opts into `sticky` — the branding itself
 *  stays put on scroll. When sticky it carries a **body-width** bottom rule (on the inner max-w-4xl
 *  container, not the full-width header — that width is deliberate, see 2026-07-19) so a single
 *  divider stays pinned directly beneath the branding as content scrolls under it. The Sharing View's
 *  section therefore no longer draws its own top rule, which used to scroll away and leave the pinned
 *  branding with nothing under it. The pinned wordmark's ink top is still 32px, so the fixed drawer
 *  icon (TOGGLE_TOP) aligns to it.
 */
export function LogoBar({ linkHome = false, sticky = false }: { linkHome?: boolean; sticky?: boolean }) {
  const { resolvedTheme } = useTheme();
  const logoVariant = resolvedTheme === "happy" ? "happy" : "default";

  const lockup = (
    <>
      {/* Nameplate: pt-[9px] matches Figma so the round mark's vertical center aligns with the
          wordmark's visual center (not its bounding-box center). Fixed, so it does not scale with
          the wordmark below 500px — which is why one icon-top value covers both breakpoints. */}
      <div className="flex flex-col items-start pt-[9px] shrink-0">
        {/* Wordmark ink tracks --foreground so it matches the hero clock and body text (#333 light,
            #1A1A1A happy, #E6E6E6 dark) rather than reading as a purer black than everything else. */}
        <HappyhourWordmark className="shrink-0 h-[43px] max-[499px]:h-[31.39px] w-auto text-foreground" />
      </div>
      {/* Round mark sits to the RIGHT of the wordmark (Figma 329:3382 → 329:3381).
          0.73 below 500px matches the Figma mobile variant ratio (31.68 / 43.392); mt-[2px] there
          nudges the scaled mark down so its top edge aligns with the "H" cap in the wordmark. */}
      <HappyhourLogo
        variant={logoVariant}
        className="shrink-0 size-[38px] max-[499px]:size-[27.74px] max-[499px]:mt-[2px]"
      />
      <span className="sr-only">Happyhour</span>
    </>
  );

  return (
    // z-40 matches the hero's sticky layer: below the fixed drawer nav (z-55) and the panel (z-70),
    // above the scrolling tiles. Only the Sharing View pins; the dashboard keeps scrolling away.
    <header
      className={`bg-background px-6 md:px-12 lg:px-24 pt-[23px] pb-[10px]${
        sticky ? " sticky top-0 z-40 sticky-layer" : ""
      }`}
    >
      <div
        className={`mx-auto max-w-4xl flex flex-row items-center pl-[10px]${
          sticky ? " border-b border-border pb-[10px]" : ""
        }`}
      >
        {linkHome ? (
          <a href="/" className="flex items-center gap-[10px] min-w-0">
            {lockup}
          </a>
        ) : (
          <h1 className="flex items-center gap-[10px] min-w-0" data-testid="text-app-title">
            {lockup}
          </h1>
        )}
      </div>
    </header>
  );
}
