import { ReactNode } from "react";
import { HappyhourLogo } from "@/components/icons/happyhour-logo";
import { HappyhourWordmark } from "@/components/icons/happyhour-wordmark";
import { SiteFooter } from "@/components/site-footer";
import { useTheme } from "@/lib/theme-provider";

interface SitePageLayoutProps {
  title: string;
  children: ReactNode;
}

/** Shared layout for content pages (About, Privacy, Support).
 *  Static header (logo links home, no drawer/sidebar), H1 + body slot, universal footer.
 *  Per Figma 272:4605 (About), 250:4243 (Privacy), 272:4634 (Support). */
export function SitePageLayout({ title, children }: SitePageLayoutProps) {
  const { resolvedTheme } = useTheme();
  const logoVariant = resolvedTheme === "happy" ? "happy" : "default";
  const wordmarkColor = resolvedTheme === "dark" ? "#FFFFFF" : "#000000";

  return (
    <main className="min-h-screen bg-background flex flex-col">
      <header className="bg-background border-b border-border px-6 md:px-12 lg:px-24 py-8">
        <div className="mx-auto max-w-4xl flex flex-row items-center gap-4 pl-[10px] pr-[10px]">
          {/* Logo + wordmark sizes mirror the home-page header at the
              non-scrolled top state (world-clock.tsx LOGO_START / WORDMARK_H_START
              with the 0.73 mobileScale below 500px). Keeping them identical
              prevents a "jump" when the user navigates between the home page
              and an ancillary page at scroll-top. */}
          <a href="/" className="flex items-center gap-[10px] min-w-0">
            <HappyhourLogo
              variant={logoVariant}
              className="shrink-0 size-[38px] max-[499px]:size-[27.74px] max-[499px]:mt-[2px]"
            />
            <div className="flex flex-col items-start pt-[9px] shrink-0">
              <HappyhourWordmark
                className="shrink-0 h-[43px] max-[499px]:h-[31.39px] w-auto"
                style={{ color: wordmarkColor }}
              />
            </div>
            <span className="sr-only">Happyhour</span>
          </a>
        </div>
      </header>

      <div className="flex-1 px-6 md:px-12 lg:px-24 pt-[35px]">
        <div className="mx-auto max-w-4xl px-[10px]">
          <h1 className="font-display text-[32px] font-black leading-[40px] tracking-[-0.8px] text-foreground">
            {title}
          </h1>
          <div className="mt-[14px] max-w-[640px]">
            {children}
          </div>
        </div>
      </div>

      <SiteFooter />
    </main>
  );
}
