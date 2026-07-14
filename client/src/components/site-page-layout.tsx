import { ReactNode } from "react";
import { LogoBar } from "@/components/logo-bar";
import { SiteFooter } from "@/components/site-footer";

interface SitePageLayoutProps {
  title: string;
  children: ReactNode;
}

/** Shared layout for content pages (About, Privacy, Support).
 *  Static header (logo links home, no drawer/sidebar), H1 + body slot, universal footer.
 *  Per Figma 272:4605 (About), 250:4243 (Privacy), 272:4634 (Support). */
export function SitePageLayout({ title, children }: SitePageLayoutProps) {
  return (
    <main className="min-h-screen bg-background flex flex-col">
      {/* Same component as the home page, so the bar cannot drift out of alignment with it.
          These pages have no hero clock, so nothing is sticky here. */}
      <LogoBar linkHome />

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
