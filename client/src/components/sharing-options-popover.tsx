import * as PopoverPrimitive from "@radix-ui/react-popover";
import { X } from "lucide-react";
import { CommitBarButton } from "@/components/commit-bar";
import { ToggleSwitch } from "@/components/toggle-switch";
import { GearIcon } from "@/components/icons/gear";

export interface ShareOptions {
  use24Hour: boolean;
  showZoneAbbr: boolean;
  includeLink: boolean;
}

interface SharingOptionsPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  options: ShareOptions;
  onChange: (patch: Partial<ShareOptions>) => void;
}

/** One settings row, copied beat-for-beat from the Sidebar's own rows (`sidebar.tsx`) — the popover
 *  is meant to read as the same kind of surface, so the label class and the 28px row height are
 *  deliberately identical rather than approximated. */
function OptionRow({
  label,
  checked,
  onChange,
  testId,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  testId?: string;
}) {
  return (
    <div className="flex items-center h-[28px]">
      <span className="flex-1 font-medium text-[14px] leading-[22px] tracking-[-0.43px] uppercase text-[#efefef]">
        {label}
      </span>
      <ToggleSwitch checked={checked} onChange={onChange} testId={testId} />
    </div>
  );
}

/**
 * The Commit Bar's sharing settings.
 *
 * Exists to break a coupling: the Sidebar's 24-Hour Clock and Time Zone Names toggles describe the
 * user's *own board*, but the share text used to read those same two values — so tailoring what a
 * recipient sees meant changing your own dashboard, with nothing on screen saying so. These three
 * options govern the message and nothing else, and persist independently.
 *
 * Built on the Radix primitives directly rather than on `ui/popover.tsx`: that wrapper bakes in
 * `w-72`, its own collision padding and a set of zoom/slide animations that fight this design, and
 * it's shared with three call sites in `digital-clock.tsx` that shouldn't be disturbed. Radix still
 * provides click-outside dismiss, Escape, focus return, and click-the-trigger-to-close.
 */
export function SharingOptionsPopover({
  open,
  onOpenChange,
  options,
  onChange,
}: SharingOptionsPopoverProps) {
  return (
    <PopoverPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <PopoverPrimitive.Trigger asChild>
        {/* Copy Link's exact gray, by sharing its component rather than its hex.
            On phones the label becomes a gear: spelled out, it can't sit beside Done / Copy Link /
            Share on one row, and the bar wrapped. `aria-label` is set at every width so the
            accessible name doesn't change with the viewport. */}
        <CommitBarButton
          variant="secondary"
          testId="button-sharing-options"
          aria-label="Sharing Options"
        >
          {/* 20px, not the source SVG's 23 — text-sm's line-height is 20px, so this keeps the
              button exactly as tall as the others (12 + 20 + 12 = 44) and, at the shared px-3,
              exactly as wide as it is tall. */}
          <GearIcon className="sm:hidden" />
          <span className="hidden sm:inline">Sharing Options</span>
        </CommitBarButton>
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          side="top"
          align="start"
          sideOffset={10}
          // Cancels the CommitBar inner pill's px-4 so the popover's left edge lands on the *bar's*
          // left edge, not the trigger's. The tail still points at the trigger's centre — Radix
          // positions the arrow against the trigger independently of alignOffset.
          alignOffset={-16}
          collisionPadding={16}
          // Escape and outside-clicks must close only this, never the share select-mode underneath.
          // `time-zone-converter.tsx` has a document-level Escape listener that tears down the whole
          // bar; stopping propagation here is what keeps the two from firing together.
          onEscapeKeyDown={(e) => e.stopPropagation()}
          // The animation lives here rather than on the surface below, because Radix's Presence
          // only waits for an exit animation it can see on *this* node — see index.css.
          className="sharing-options-content z-[80] outline-none"
          data-testid="sharing-options-popover"
        >
          {/* Matches the Commit Bar's own width on mobile (the bar is inset px-6, so 100vw-48px),
              which with alignOffset={-16} makes the two edges flush. A narrower fixed width sliced
              vertically through a clock row behind it and read as a clipping bug. */}
          <div className="w-[calc(100vw-48px)] sm:w-[260px] rounded-[15px] bg-[#333] shadow-[0_1px_2px_rgba(0,0,0,0.15)] overflow-hidden">
            {/* Measured: 18px above the header, 31px below the last toggle. The bottom carries an
                extra 10px on purpose (2026-08-08) — the rows sat too close to the edge — and the
                last row is a 28px box holding an 18px toggle, so 5px of its own slack counts too. */}
            <div className="sharing-options-rows flex flex-col gap-[20px] px-[20px] pt-[18px] pb-[26px]">
              {/* No negative margins here: the X sits on the same 20px right gutter as the toggle
                  rail below it, and items-center puts it on the label's optical centre. */}
              <div className="flex items-center">
                <span className="flex-1 font-medium text-[14px] leading-[22px] tracking-[-0.43px] uppercase text-[#9ca3af]">
                  Sharing Options
                </span>
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  aria-label="Close sharing options"
                  data-testid="button-sharing-options-close"
                  className="shrink-0 flex h-[22px] w-[22px] items-center justify-center rounded-full border border-[#6b7280] text-[#9ca3af] transition-colors hover:border-[#efefef] hover:text-[#efefef]"
                >
                  <X className="h-[12px] w-[12px]" strokeWidth={2.5} />
                </button>
              </div>

              <OptionRow
                label="24-Hour Clock"
                checked={options.use24Hour}
                onChange={(v) => onChange({ use24Hour: v })}
                testId="toggle-share-24h"
              />
              <OptionRow
                label="Time Zone Name"
                checked={options.showZoneAbbr}
                onChange={(v) => onChange({ showZoneAbbr: v })}
                testId="toggle-share-zone-abbr"
              />
              {/* testId kept from the checkbox this replaced, the same way "Cancel" -> "Done" and
                  "Include my local time" -> "Include Happyhour link" kept theirs. */}
              <OptionRow
                label="Happyhour Link"
                checked={options.includeLink}
                onChange={(v) => onChange({ includeLink: v })}
                testId="checkbox-include-local"
              />
            </div>
          </div>

          {/* Direct child of Content, not nested in the surface — Radix positions it against the
              trigger, and the surface's overflow-hidden would clip it. */}
          <PopoverPrimitive.Arrow className="fill-[#333]" width={16} height={8} />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
