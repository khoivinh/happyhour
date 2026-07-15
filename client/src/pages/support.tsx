import { SitePageLayout } from "@/components/site-page-layout";

const LINK_CLASS =
  "font-bold no-underline text-inherit hover:text-[#3B82F6] transition-colors";

export default function Support() {
  return (
    <SitePageLayout title="Support">
      <p className="text-[14px] leading-[22px] text-foreground">
        For questions, comments and suggestions,{" "}
        <a
          href="mailto:hellodesigndept@gmail.com"
          className={`${LINK_CLASS} underline`}
        >
          send us an email
        </a>
        .
      </p>

      <section className="mt-[20px]">
        <h2 className="font-display text-[18px] font-black leading-[24px] text-foreground">
          Location access
        </h2>
        <p className="mt-[10px] text-[14px] leading-[22px] text-foreground">
          Happyhour uses your location to show your local time and weather more
          precisely. If you weren’t asked or you previously denied location
          access, follow the instructions below to turn it on — and then reload
          the page.
        </p>
        <p className="mt-[20px] text-[14px] leading-[22px] text-foreground">
          <a
            href="https://support.apple.com/guide/personal-safety/manage-location-services-settings-ips9bf20ad2f/web"
            target="_blank"
            rel="noopener noreferrer"
            className={LINK_CLASS}
          >
            Safari
          </a>{" "}
          — On iPhone: Settings → Privacy &amp; Security → Location Services (on)
          → Safari Websites → While Using the App. On Mac: Safari → Settings →
          Websites → Location → set happyhour.day to Allow.
        </p>
        <p className="mt-[20px] text-[14px] leading-[22px] text-foreground">
          <a
            href="https://support.google.com/chrome/answer/142065"
            target="_blank"
            rel="noopener noreferrer"
            className={LINK_CLASS}
          >
            Chrome
          </a>{" "}
          — On iPhone: open the Settings → Apps → Chrome → Location → While Using
          the App, then return to Happyhour, reload, and tap Allow. On desktop:
          click the tune/location icon at the left of the address bar (or
          Settings → Privacy and security → Site settings → Location) and set
          happyhour.day to Allow.
        </p>
        <p className="mt-[20px] text-[14px] leading-[22px] text-foreground">
          <a
            href="https://support.mozilla.org/en-US/kb/does-firefox-share-my-location-websites"
            target="_blank"
            rel="noopener noreferrer"
            className={LINK_CLASS}
          >
            Firefox
          </a>{" "}
          — On iPhone: open the Settings → Apps → Firefox → Location → While
          Using the App, then return to Happyhour, reload, and tap Allow. On
          desktop: click the padlock at the left of the address bar and clear the
          blocked “Access Your Location” permission (or Settings → Privacy &amp;
          Security → Permissions → Location), then reload and choose Allow.
        </p>
      </section>
    </SitePageLayout>
  );
}
