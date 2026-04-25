import { SitePageLayout } from "@/components/site-page-layout";

/* Link styles per 2026-04-25 spec:
 *  - Bold, no underline, hover #3B82F6 — applies to every bold word in body
 *    paragraphs across About / Privacy / Support.
 *  - The mailto link "send us an email" (Privacy + Support only) adds an
 *    underline to that base style.
 */
const LINK_CLASS =
  "font-bold no-underline text-inherit hover:text-[#3B82F6] transition-colors";

export default function About() {
  return (
    <SitePageLayout title="About">
      <p className="text-[14px] leading-[22px] text-foreground">
        <a
          href="https://happyhour.day"
          target="_blank"
          rel="noopener noreferrer"
          className={LINK_CLASS}
        >
          Happyhour
        </a>{" "}
        is a world clock designed and developed by Khoi Vinh in Brooklyn, NY. Stay tuned for an iOS version. For more information, visit{" "}
        <a
          href="https://designdept.com"
          target="_blank"
          rel="noopener noreferrer"
          className={LINK_CLASS}
        >
          DesignDept.com
        </a>
        .
      </p>
    </SitePageLayout>
  );
}
