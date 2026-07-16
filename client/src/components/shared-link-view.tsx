import { useCallback, useMemo, useRef, useState } from "react";
import { DigitalClock } from "@/components/digital-clock";
import { CommitBar, CommitBarActions, CommitBarButton } from "@/components/commit-bar";
import { MAX_CLOCKS } from "@/components/time-zone-converter";
import { getCityByKey, formatCityDisplay, getTimeInCityZone } from "@/lib/city-lookup";

interface SharedLinkViewProps {
  /** Shared city keys, already validated against the city lookup by the caller. */
  keys: string[];
  /** Frozen instant from &t=, or null for a live share. */
  t: number | null;
  /** The recipient's current board — these can't be added again. */
  ownedKeys: string[];
  use24Hour: boolean;
  /** Commit the chosen cities. Fired after the retire transition, not on click. */
  onAdd: (keys: string[]) => void;
  onCancel: () => void;
}

const NUMBER_WORDS = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight",
  "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen",
];

/** "Two time zones shared with you." Spelled out because the headline is a sentence, not a stat;
 *  past sixteen (more than a board can hold) digits are fine — nobody reads "twenty-three" as prose. */
function headlineFor(count: number): string {
  const word = NUMBER_WORDS[count] ?? String(count);
  const capitalized = word.charAt(0).toUpperCase() + word.slice(1);
  return `${capitalized} time zone${count === 1 ? "" : "s"} shared with you.`;
}

/**
 * The surface a shared link lands on (Figma 344:3787).
 *
 * It replaced a modal dialog that asked "Add shared clocks?" before the recipient could see what
 * was on offer. This shows the cities first — running, in their real time — and asks after.
 *
 * Every tile here is a tile being offered, so the fill can't distinguish anything: all of them wear
 * the hover skin to mark the surface as a mode apart, and the check carries selection. Cities
 * already on the recipient's board show a settled gray check and can't be toggled.
 */
export function SharedLinkView({ keys, t, ownedKeys, use24Hour, onAdd, onCancel }: SharedLinkViewProps) {
  const owned = useMemo(() => new Set(ownedKeys), [ownedKeys]);
  /** How many of the shared cities the board can still take. Cities the recipient already has
   *  cost nothing — they're not being added. */
  const room = Math.max(0, MAX_CLOCKS - ownedKeys.length);
  const newKeys = useMemo(() => keys.filter((k) => !owned.has(k)), [keys, owned]);

  // Pre-check what fits, in link order. Beyond that the recipient swaps rather than overflows:
  // nothing can be selected that wouldn't survive the merge, so Add never silently drops a city.
  const [selected, setSelected] = useState<Set<string>>(() => new Set(newKeys.slice(0, room)));
  const [retiring, setRetiring] = useState(false);
  const pending = useRef<string[] | null>(null);

  /** What the bar says. The cap is stated up front rather than apologised for afterwards: the
   *  recipient can see which cities won't fit and swap before committing, so Add is always
   *  literally true. */
  const prompt =
    newKeys.length === 0
      ? "You already have these clocks."
      : room === 0
        ? `Your clocks are full — Happyhour holds ${MAX_CLOCKS}.`
        : newKeys.length > room
          ? `Room for ${room === 1 ? "one more" : `${room} more`} — Happyhour holds ${MAX_CLOCKS}.`
          : "Add these cities to your Happyhour?";

  const toggle = useCallback(
    (key: string) => {
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else if (next.size < room) next.add(key);
        else return prev; // at the cap — uncheck something first
        return next;
      });
    },
    [room]
  );

  /** Retire the scaffolding, then hand the cities over. Mirrors the onboarding tagline's exit:
   *  opacity goes first and quickly, then the row collapses and the board arrives underneath. */
  const handleAdd = useCallback(() => {
    const chosen = keys.filter((k) => selected.has(k));
    pending.current = chosen;
    // Reduced motion never fires transitionend, so there'd be nothing to wait for.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      onAdd(chosen);
      return;
    }
    setRetiring(true);
  }, [keys, selected, onAdd]);

  const handleRetired = useCallback(
    (e: { propertyName: string }) => {
      // Both opacity and grid-template-rows land here; the row collapse is the one that finishes last.
      if (e.propertyName === "grid-template-rows" && pending.current) onAdd(pending.current);
    },
    [onAdd]
  );

  const baseTime = t != null ? new Date(t) : new Date();

  return (
    <>
      {/* The rule above the headline, per Figma — --border is #a3922a in happy, matching the frame. */}
      <section className="border-t border-border pt-[25px]">
        <div
          onTransitionEnd={handleRetired}
          className={`grid overflow-hidden ease-out transition-[opacity,grid-template-rows] [transition-duration:180ms,360ms] [transition-delay:0ms,150ms] motion-reduce:transition-none ${
            retiring ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100"
          }`}
        >
          <div className="min-h-0 overflow-hidden px-[10px] pb-[32px]">
            {/* Same type as the onboarding tagline (Figma's spec for both is identical), but not
                its sm:w-3/5 — that width is tuned to break "Welcome to the indispensable world
                clock." into two lines. This sentence is shorter and Figma sets it on one, so it
                gets the full column and wraps only when a narrow screen makes it. */}
            <h2
              className="w-full font-display font-black text-foreground text-[36px] leading-[38px] tracking-[-1px]"
              data-testid="text-share-headline"
            >
              {headlineFor(keys.length)}
            </h2>
          </div>
        </div>

        <div
          className={`grid grid-cols-1 gap-[5px] sm:grid-cols-2 sm:gap-2.5 lg:grid-cols-3 transition-opacity duration-200 motion-reduce:transition-none ${
            retiring ? "opacity-0" : "opacity-100"
          }`}
        >
          {keys.map((key) => {
            const city = getCityByKey(key);
            const isLocked = owned.has(key);
            return (
              <div key={key} className="relative my-[3px]" data-testid={`shared-zone-${key}`}>
                <DigitalClock
                  time={city ? getTimeInCityZone(baseTime, city.offset) : baseTime}
                  cityName={city ? formatCityDisplay(city) : key}
                  cityShortName={city ? city.name : key}
                  timezone={city?.gmtLabel || ""}
                  selectedZoneKey={key}
                  zoneKey={key}
                  use24Hour={use24Hour}
                  isSelectMode
                  pinHoverSkin
                  isLocked={isLocked}
                  isBlocked={!isLocked && !selected.has(key) && selected.size >= room}
                  isSelected={selected.has(key)}
                  onToggleSelect={toggle}
                />
              </div>
            );
          })}
        </div>
      </section>

      {!retiring && (
        <CommitBar testId="share-import-bar">
          <p className="text-sm font-medium text-[var(--share-bar-fg)]" data-testid="text-share-import-prompt">
            {prompt}
          </p>
          <CommitBarActions>
            <CommitBarButton variant="ghost" onClick={onCancel} testId="button-share-import-cancel">
              Cancel
            </CommitBarButton>
            <CommitBarButton
              variant="primary"
              onClick={handleAdd}
              disabled={selected.size === 0}
              testId="button-share-import-add"
            >
              {selected.size > 0 ? `Add ${selected.size}` : "Add"}
            </CommitBarButton>
          </CommitBarActions>
        </CommitBar>
      )}
    </>
  );
}
