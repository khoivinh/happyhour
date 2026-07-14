import { LogoBar } from "@/components/logo-bar";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-background">
      {/* No scroll animation and no drawer here (there is no sidebar on 404), but the same logo bar. */}
      <LogoBar linkHome />

      {/* Error hero block — matches Figma 232-3847 */}
      <div className="px-6 md:px-12 lg:px-24 pt-[35px]">
        <div className="mx-auto max-w-4xl px-[10px]">
          <p className="h-[20px] text-[14px] leading-[20px] font-medium uppercase tracking-[0.35px] text-muted-foreground">
            Error
          </p>
          <p className="font-display text-[96px] leading-[96px] font-black tracking-[-2.4px] text-foreground">
            404
          </p>
          <p className="text-[14px] leading-[20px] text-red-500 mt-[8px]">
            Sorry, couldn’t find your page.
          </p>
        </div>
      </div>
    </main>
  );
}
