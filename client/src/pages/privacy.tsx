import { SitePageLayout } from "@/components/site-page-layout";
import { openCookiePreferences } from "@/lib/cookie-consent";

const LINK_CLASS =
  "font-bold no-underline text-inherit hover:text-[#3B82F6] transition-colors";

/** Privacy copy derived from Figma 250:4243, adjusted in the 2026-04-24 batch
 *  to reflect the new re-entry pattern for cookie preferences (floating icon
 *  removed; preferences reopen via this page's button + universal footer link).
 *  2026-04-25: every bold word linked per the spec; only the mailto link
 *  carries an underline; hover state across all links is #3B82F6. */
export default function Privacy() {
  return (
    <SitePageLayout title="Privacy">
      <p className="text-[14px] leading-[22px] text-foreground">
        When you sign in to{" "}
        <a
          href="https://happyhour.day"
          target="_blank"
          rel="noopener noreferrer"
          className={LINK_CLASS}
        >
          Happyhour
        </a>
        , we store the cities you've added and your display preferences so they sync across your devices. We use{" "}
        <a
          href="https://clerk.com"
          target="_blank"
          rel="noopener noreferrer"
          className={LINK_CLASS}
        >
          Clerk
        </a>{" "}
        for sign-in and{" "}
        <a
          href="https://cloudflare.com"
          target="_blank"
          rel="noopener noreferrer"
          className={LINK_CLASS}
        >
          Cloudflare D1
        </a>{" "}
        for storage. With your consent we use{" "}
        <a
          href="https://marketingplatform.google.com/about/analytics/"
          target="_blank"
          rel="noopener noreferrer"
          className={LINK_CLASS}
        >
          Google Analytics
        </a>{" "}
        to understand site usage — manage your preferences anytime below. We don't sell or share your data, and we don't set advertising cookies. To delete your account and all associated data,{" "}
        <a
          href="mailto:hellodesigndept@gmail.com"
          className={`${LINK_CLASS} underline`}
        >
          send us an email
        </a>
        .
      </p>

      <div className="mt-[20px] flex flex-col gap-[11px] items-start">
        <p className="text-[14px] leading-[20px] tracking-[0.35px] text-foreground">
          Manage your cookie preferences here.
        </p>
        <button
          type="button"
          onClick={openCookiePreferences}
          className="bg-[#FFD900] text-[#333] font-bold text-[10px] uppercase rounded-[6px] py-[9px] px-[12px] hover:opacity-90 transition-opacity focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#333]"
        >
          Cookie preferences
        </button>
      </div>
    </SitePageLayout>
  );
}
