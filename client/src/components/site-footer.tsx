import { Link } from "wouter";
import { openCookiePreferences } from "@/lib/cookie-consent";

interface SiteFooterProps {
  /** Shows the "allow location" notice above the copyright line. Home page only — the content
   *  pages don't resolve geolocation, so they simply omit it. */
  geoDenied?: boolean;
}

/** Universal footer shown on the home page and all content pages.
 *  Copyright line + About/Privacy/Cookie Preferences/Support nav. Per Figma 272:4560. */
export function SiteFooter({ geoDenied = false }: SiteFooterProps = {}) {
  return (
    <footer className="px-6 md:px-12 lg:px-24 pt-[220px] pb-[120px]">
      <div className="mx-auto max-w-4xl px-[10px]">
        {/* Lives here rather than beside the hero city name: the hero's city row is a fixed
            20px tall, so on mobile this message wrapped and collided with the time display. */}
        {geoDenied && (
          <p
            className="mb-[10px] text-[12px] leading-[22px] tracking-[-0.43px] text-muted-foreground"
            data-testid="text-geo-denied-hint"
          >
            Allow location for a closer match.
          </p>
        )}
        <p className="text-[12px] leading-[22px] tracking-[-0.43px] text-foreground capitalize">
          <span className="font-medium">©2026 </span>
          <a
            href="https://designdept.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold no-underline text-inherit hover:opacity-80 transition-opacity"
          >
            Design Dept Partners LLC
          </a>
        </p>
        <nav className="mt-[4px] flex items-center gap-[10px] text-[12px] leading-[22px] text-muted-foreground">
          <Link href="/about" className="hover:text-foreground transition-colors">About</Link>
          <span aria-hidden="true">•</span>
          <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
          <span aria-hidden="true">•</span>
          <button
            type="button"
            onClick={openCookiePreferences}
            className="hover:text-foreground transition-colors bg-transparent border-0 p-0 cursor-pointer font-inherit text-inherit leading-inherit"
          >
            Cookie Preferences
          </button>
          <span aria-hidden="true">•</span>
          <Link href="/support" className="hover:text-foreground transition-colors">Support</Link>
        </nav>
      </div>
    </footer>
  );
}
