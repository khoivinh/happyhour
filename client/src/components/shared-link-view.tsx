import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  /** The recipient dismissed the Commit Bar (Select Mode → Resting). Analytics only — the view
   *  stays mounted; escaping the Sharing View is the logo's job, not Cancel's. */
  onDismiss?: () => void;
}

const NUMBER_WORDS = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight",
  "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen",
];

/** The headline names what the recipient is looking at, and which of the two things it is.
 *  `live` (a real-time share, or a custom one after Reset Time) describes the clocks as showing the
 *  current time; otherwise it's a fixed conversion. Spelled out because it's a sentence, not a stat;
 *  past sixteen (more than a board can hold) digits are fine — nobody reads "twenty-three" as prose. */
function headlineFor(count: number, live: boolean): string {
  const word = NUMBER_WORDS[count] ?? String(count);
  const where = count === 1 ? "this city" : `these ${word} cities`;
  return live
    ? `Current time in ${where}.`
    : `Time zone conversion for ${where}.`;
}

/**
 * The surface a shared link lands on (Figma 344:3787).
 *
 * It replaced a modal dialog that asked "Add shared clocks?" before the recipient could see what
 * was on offer. This shows the cities first — running, in their real time — and asks after.
 *
 * It's a place, not a prompt: the recipient can keep it and reuse it. Two states:
 *  - **Select Mode** (arrival): every tile wears the hover skin and a checkmark, and the Commit Bar
 *    offers "Add these clocks…". The tiles are being offered, so the fill can't distinguish one from
 *    another — the check carries selection. Owned cities show a settled gray check and can't toggle.
 *  - **Resting** (after the bar is dismissed): plain live clocks, each with an ellipsis "Save {city}"
 *    menu that flips the tile — and the view — back into Select Mode.
 * Cancel drops from Select Mode to Resting; it never tears the view down. The clocks tick in real
 * time, except a shared instant (&t=) freezes them until the recipient hits Reset Time.
 */
export function SharedLinkView({ keys, t, ownedKeys, use24Hour, onAdd, onDismiss }: SharedLinkViewProps) {
  const owned = useMemo(() => new Set(ownedKeys), [ownedKeys]);
  /** How many of the shared cities the board can still take. Cities the recipient already has
   *  cost nothing — they're not being added. */
  const room = Math.max(0, MAX_CLOCKS - ownedKeys.length);
  const newKeys = useMemo(() => keys.filter((k) => !owned.has(k)), [keys, owned]);

  // Arrival is Select Mode — unless the recipient already owns every shared city (nothing to add):
  // then skip straight to Resting, so there's no Commit Bar to dismiss and no selection to make.
  const [mode, setMode] = useState<"select" | "resting">(
    newKeys.length === 0 ? "resting" : "select"
  );
  // Pre-check what fits, in link order. Beyond that the recipient swaps rather than overflows:
  // nothing can be selected that wouldn't survive the merge, so Add never silently drops a city.
  const [selected, setSelected] = useState<Set<string>>(() => new Set(newKeys.slice(0, room)));
  const [retiring, setRetiring] = useState(false);
  const pending = useRef<string[] | null>(null);

  // The view persists now, so the tiles keep their own time. A live share ticks each minute; a
  // shared instant (&t=) stays frozen until the recipient chooses Reset Time.
  const [now, setNow] = useState(() => new Date());
  const [resetToLive, setResetToLive] = useState(false);
  const frozen = t != null && !resetToLive;
  useEffect(() => {
    if (frozen || retiring) return; // nothing to tick while frozen, and don't fight the retire
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, [frozen, retiring]);
  const baseTime = frozen ? new Date(t) : now;

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
          : "Add these clocks to your Happyhour?";

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

  /** Cancel: leave Select Mode for Resting. The view stays put — this is the whole point of the
   *  round. `onDismiss` is analytics only. */
  const dismissBar = useCallback(() => {
    setMode("resting");
    onDismiss?.();
  }, [onDismiss]);

  // Esc is the keyboard equivalent of Cancel: it drops Select Mode to Resting without tearing the
  // view down. Mirrors the board's share-mode Escape handler (time-zone-converter.tsx).
  useEffect(() => {
    if (mode !== "select") return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") dismissBar();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mode, dismissBar]);

  /** "Save {city}" from a resting tile: re-enter Select Mode with just this city checked. An owned
   *  or over-cap city has nothing to pre-check, so the bar opens at Add-0 and the recipient picks. */
  const saveFromRest = useCallback(
    (key: string) => {
      setSelected(!owned.has(key) && room > 0 ? new Set([key]) : new Set());
      setMode("select");
    },
    [owned, room]
  );

  /** Flip a custom share between its frozen instant and the live clock. The link label and the
   *  headline both read off `frozen`, so one toggle drives all three. */
  const toggleTime = useCallback(() => {
    setResetToLive((v) => !v);
    setNow(new Date()); // catch up immediately rather than waiting out the first interval
  }, []);

  const inSelect = mode === "select";

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
            {/* Same type and width as the onboarding tagline (sm:w-3/5, ~60% on desktop) so the two
                headlines share a column measure. These sentences ("Current time in these N cities.")
                run long enough to want the constrained width; below sm it goes full. */}
            <h2
              className="w-full sm:w-3/5 font-display font-black text-foreground text-[36px] leading-[38px] tracking-[-1px]"
              data-testid="text-share-headline"
            >
              {headlineFor(keys.length, !frozen)}
            </h2>
          </div>
        </div>

        {/* Reset Time — custom shares only. The slot is reserved whenever there's a frozen instant
            to toggle (t != null), so the grid never jumps; the link itself hides in Select Mode and
            appears once the recipient drops to Resting via Cancel. Its label toggles with the state:
            "Reset Time" while frozen, "Restore Custom Time" once switched to live. Right-aligned above
            the first tile, styled to match the hero's own reset link (digital-clock.tsx). */}
        {t != null && (
          <div
            className={`flex justify-end px-[10px] pb-[10px] transition-opacity duration-200 motion-reduce:transition-none ${
              retiring ? "opacity-0" : "opacity-100"
            }`}
          >
            <button
              onClick={toggleTime}
              className={`font-semibold text-sm uppercase text-[#4e82ee] px-2.5 py-[3px] cursor-pointer hover:opacity-80 transition-opacity ${
                inSelect ? "invisible" : ""
              }`}
              aria-hidden={inSelect || undefined}
              tabIndex={inSelect ? -1 : undefined}
              data-testid="button-share-reset-time"
            >
              {frozen ? "Reset Time" : "Restore Custom Time"}
            </button>
          </div>
        )}

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
                  isSelectMode={inSelect}
                  pinHoverSkin={inSelect}
                  reserveGripSlot
                  isLocked={isLocked}
                  isBlocked={!isLocked && !selected.has(key) && selected.size >= room}
                  isSelected={selected.has(key)}
                  onToggleSelect={toggle}
                  onSave={saveFromRest}
                />
              </div>
            );
          })}
        </div>
      </section>

      {inSelect && !retiring && (
        <CommitBar testId="share-import-bar">
          <p className="text-sm font-medium text-[var(--share-bar-fg)]" data-testid="text-share-import-prompt">
            {prompt}
          </p>
          <CommitBarActions>
            <CommitBarButton variant="ghost" onClick={dismissBar} testId="button-share-import-cancel">
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
