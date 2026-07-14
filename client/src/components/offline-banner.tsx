import { useOnlineStatus } from "@/hooks/use-online-status";

/** Yellow band shown below the sticky header when the browser reports offline.
 *  Desktop (>=640px): bold headline + secondary explanation.
 *  Mobile (<640px):   bold headline only.
 *  Theme-specific colors live in `client/src/index.css` under `.offline-banner`. */
export function OfflineBanner() {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="offline-banner"
      className="offline-banner mt-[10px] rounded-[5px] p-[10px] text-[10px] leading-[normal] tracking-[0.35px] font-medium"
    >
      <span className="font-bold">You’re Currently Offline</span>
      <span className="hidden sm:inline">{"  Weather and sync will resume when you’re back online."}</span>
    </div>
  );
}
