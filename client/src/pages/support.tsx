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
    </SitePageLayout>
  );
}
