import React, { useState, useRef, useEffect, useMemo, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { GripVertical, Check, ChevronsUpDown, Share, Trash2, Plus } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { getCityByKey, searchCities, formatCityDetail, type TimezoneOption } from "@/lib/city-lookup";
import { useWeather, getTemperatureColor } from "@/hooks/use-weather";

function EllipsisCircleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="17"
      height="17"
      viewBox="0 0 17 17"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="8.5" cy="8.5" r="7.5" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="4.75" cy="8.5" r="1.1" fill="currentColor" />
      <circle cx="8.5" cy="8.5" r="1.1" fill="currentColor" />
      <circle cx="12.25" cy="8.5" r="1.1" fill="currentColor" />
    </svg>
  );
}

/** `step` for the time inputs, in seconds. Constrains the native picker wheel and the arrow keys to
 *  five-minute jumps; a directly-typed value is deliberately left alone, so 5:03 still commits as
 *  5:03. Values >= 60 also keep the browser from growing a seconds field. */
const FIVE_MINUTES_S = 300;

interface DigitalClockProps {
  time: Date;
  cityName: string;
  /** Region-free city name (e.g. "New York City", not "New York City, NY"). Used in the
   *  tile menu and remove dialog where the qualified `cityName` reads as extra list items. */
  cityShortName?: string;
  timezone: string;
  isHero?: boolean;
  showSeconds?: boolean;
  isSelectable?: boolean;
  selectedZoneKey?: string;
  onZoneChange?: (zoneKey: string) => void;
  isNew?: boolean;
  isHighlighted?: boolean;
  isDraggable?: boolean;
  isBeingDragged?: boolean;
  zoneKey?: string;
  onTimeUpdate?: (zoneKey: string, hours: number, minutes: number) => void;
  onRemove?: () => void;
  /** Enters the share flow for this tile's city. Present on grid tiles regardless of
   *  tile count (unlike onRemove), so Share stays reachable even on the last tile. */
  onShare?: (zoneKey: string) => void;
  /** Sharing View resting state: the tile's ellipsis menu offers a single "Save {city}" item that
   *  flips the view back into Select Mode with this city checked. Mutually exclusive with the
   *  board's Share/Delete menu — the Sharing View passes onSave and neither of the others. */
  onSave?: (zoneKey: string) => void;
  /** Share select-mode: when true the whole tile becomes a selection toggle and its
   *  inner controls (time edit, city picker, reset, ellipsis) go inert. */
  isSelectMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (zoneKey: string) => void;
  /** Select-mode variant: this city is already on the recipient's board, so it shows a settled
   *  gray check and can't be toggled — there's nothing to decide. Sharing View only. */
  isLocked?: boolean;
  /** Select-mode variant: selectable in principle, but the board is full right now. Distinct from
   *  isLocked: unchecking another city frees this one, so it isn't disabled — just out of room.
   *  Without this the tile looks identical to a checkable one and simply ignores taps. */
  isBlocked?: boolean;
  /** Select-mode variant: hold the hover skin at rest instead of tinting selected tiles.
   *  The Sharing View is entirely made of tiles being offered, so the fill can't distinguish
   *  anything — it marks the surface as a different mode, and the check carries selection.
   *  (Figma 344:3787 pins every tile to --tile-states/hover.) */
  pinHoverSkin?: boolean;
  /** Reserve the left grip slot as an invisible placeholder even when the tile isn't draggable or
   *  in select mode. The Sharing View's resting tiles use this so their content column doesn't
   *  shift left when the check/select scaffolding drops away — geometry stays identical to Select
   *  Mode (house rule: preserve layout across similar states). */
  reserveGripSlot?: boolean;
  /** Select-mode variant: keep the check slot's geometry but paint no check. The signed-out Sharing
   *  View shows the tiles as a display-only preview (register to keep them all), so there's nothing
   *  to select — the check would imply a choice that isn't offered. Layout is unchanged; only the
   *  17×17 mark is hidden. Defaults true so every existing caller is untouched. */
  showSelectCheck?: boolean;
  isDragActive?: boolean;
  dragHandleListeners?: Record<string, unknown>;
  heroDate?: Date;
  isCustomMode?: boolean;
  onReset?: () => void;
  use24Hour?: boolean;
  relativeOffset?: number;
  /** When true (hero only), shows a small "Allow location for a closer match." hint
   *  next to the city name. Set by the caller after browser geolocation is denied. */
}

/** The tile's hover fill (Figma `--tile-states/hover`). Named because the Sharing View pins it on
 *  at rest, where the hover pseudo-class can't reach it. */
const HOVER_SKIN = "bg-[#f0f0f0] dark:bg-[#2a2a2a]";

function CitySelector({
  selectedCityKey,
  onCityChange,
  onOpenChange
}: {
  selectedCityKey: string;
  onCityChange: (cityKey: string) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  const selectedCity = getCityByKey(selectedCityKey);

  // When no search is active, ensure the selected city is present so the scroll-to-current
  // effect below can find and center it (cities list is truncated to 100 by default).
  const filteredCities = useMemo(() => {
    const base = searchCities(searchValue, 100);
    if (!searchValue.trim() && selectedCity && !base.some((c) => c.key === selectedCityKey)) {
      return [selectedCity, ...base];
    }
    return base;
  }, [searchValue, selectedCity, selectedCityKey]);

  // Scroll selected city into view when popover opens.
  useEffect(() => {
    if (!open || !selectedCityKey) return;
    const raf = requestAnimationFrame(() => {
      const item = document.querySelector<HTMLElement>(
        `[data-testid="city-option-${selectedCityKey}"]`
      );
      item?.scrollIntoView({ block: "center" });
    });
    return () => cancelAnimationFrame(raf);
  }, [open, selectedCityKey]);

  return (
    <Popover
      open={open}
      onOpenChange={(isOpen) => {
        setOpen(isOpen);
        onOpenChange(isOpen);
        if (!isOpen) setSearchValue("");
      }}
    >
      <PopoverTrigger asChild>
        <button
          className="flex items-center gap-1 text-sm font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors focus:outline-none py-2 touch-manipulation text-left"
          data-testid="button-city-selector"
        >
          <span className="truncate">{selectedCity?.name || "Select city"}</span>
          <ChevronsUpDown className="h-3 w-3 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0 z-[60] dark:border-[#333333]" align="start" collisionPadding={20}>
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search cities..."
            value={searchValue}
            onValueChange={setSearchValue}
            onKeyDown={(e) => {
              if (e.key === " ") {
                e.stopPropagation();
              }
            }}
            data-testid="input-city-search"
          />
          <CommandList>
            <CommandEmpty>Can’t find “{searchValue}”</CommandEmpty>
            <CommandGroup>
              {filteredCities.map((city) => (
                <CommandItem
                  key={city.key}
                  value={city.key}
                  onSelect={() => {
                    onCityChange(city.key);
                    // Close the popover via both Radix's controlled state AND the parent's
                    // `isDropdownOpen` (which drives the tile's yellow focus background).
                    // Calling only `setOpen(false)` here bypasses the parent callback because
                    // Radix doesn't fire `onOpenChange` for controlled-prop updates from our side,
                    // leaving the tile stuck in the yellow focus state when no zone swap happens.
                    setOpen(false);
                    onOpenChange(false);
                    setSearchValue("");
                  }}
                  data-testid={`city-option-${city.key}`}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selectedCityKey === city.key ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col">
                    <span>{city.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatCityDetail(city)}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function formatRelativeOffset(offset: number): string {
  if (offset === 0) return "0HR";
  const sign = offset > 0 ? "+" : "";
  // Preserve sub-hour zones like India (+5:30) → "+10.5HR". Round to two
  // decimals to guard against float noise; trailing zeros are dropped by
  // Number's string conversion (10 → "10", 10.5 → "10.5").
  const value = Math.round(offset * 100) / 100;
  return `${sign}${value}HR`;
}

function getDayIndicator(tileTime: Date, heroDate?: Date): "next" | "prev" | null {
  if (!heroDate) return null;
  const tileDay = tileTime.getDate();
  const tileMonth = tileTime.getMonth();
  const tileYear = tileTime.getFullYear();
  const heroDay = heroDate.getDate();
  const heroMonth = heroDate.getMonth();
  const heroYear = heroDate.getFullYear();

  if (tileYear > heroYear || (tileYear === heroYear && (tileMonth > heroMonth || (tileMonth === heroMonth && tileDay > heroDay)))) {
    return "next";
  }
  if (tileYear < heroYear || (tileYear === heroYear && (tileMonth < heroMonth || (tileMonth === heroMonth && tileDay < heroDay)))) {
    return "prev";
  }
  return null;
}

export function DigitalClock({
  time,
  cityName,
  cityShortName,
  timezone,
  isHero = false,
  showSeconds = false,
  isSelectable = false,
  selectedZoneKey,
  onZoneChange,
  isNew = false,
  isHighlighted = false,
  isDraggable = false,
  isBeingDragged = false,
  zoneKey,
  onTimeUpdate,
  onRemove,
  onShare,
  onSave,
  isSelectMode = false,
  isSelected = false,
  onToggleSelect,
  isLocked = false,
  isBlocked = false,
  pinHoverSkin = false,
  reserveGripSlot = false,
  showSelectCheck = true,
  isDragActive = false,
  dragHandleListeners,
  heroDate,
  isCustomMode = false,
  onReset,
  use24Hour = true,
  relativeOffset,
}: DigitalClockProps) {
  const rawHours = time.getHours();
  const minutes = time.getMinutes().toString().padStart(2, "0");
  const seconds = time.getSeconds().toString().padStart(2, "0");

  const amPm = rawHours >= 12 ? "PM" : "AM";

  let displayHours: string;
  let timeString: string;
  if (use24Hour) {
    displayHours = rawHours.toString().padStart(2, "0");
    timeString = showSeconds ? `${displayHours}:${minutes}:${seconds}` : `${displayHours}:${minutes}`;
  } else {
    const h12 = rawHours % 12 || 12;
    displayHours = h12.toString();
    timeString = showSeconds
      ? `${displayHours}:${minutes}:${seconds}`
      : `${displayHours}:${minutes}`;
  }

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTime, setEditTime] = useState("");
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const editContainerRef = useRef<HTMLDivElement>(null);

  // Fetch weather data for this timezone
  const { data: weather, isError: weatherUnavailable } = useWeather(zoneKey || selectedZoneKey);

  function handleTimeClick() {
    if (onTimeUpdate && zoneKey) {
      setEditTime(`${rawHours.toString().padStart(2, "0")}:${minutes}`);
      setIsEditing(true);
    }
  }

  function handleUpdateClick() {
    if (onTimeUpdate && zoneKey && editTime) {
      const [h, m] = editTime.split(":").map(Number);
      onTimeUpdate(zoneKey, h, m);
      setIsEditing(false);
    }
  }

  /** Abandon the edit without applying it — the same outcome as clicking outside. */
  function cancelEdit() {
    setIsEditing(false);
    setEditTime("");
  }

  /** Keyboard commit/cancel for the time inputs. Escape *discards* rather than commits, matching
   *  the click-outside behaviour above and the two other Escape bindings in the app (share
   *  select-mode, and the Sharing View's drop to resting).
   *
   *  Both keys stop propagation: those other bindings listen on `document`, so an un-stopped
   *  Escape here would close the editor *and* tear down share mode in the same keystroke. */
  function handleEditKeyDown(e: ReactKeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      handleUpdateClick();
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      cancelEdit();
    }
  }

  // Close editing when clicking outside
  useEffect(() => {
    if (!isEditing) return;
    function handleClickOutside(e: MouseEvent) {
      if (editContainerRef.current && !editContainerRef.current.contains(e.target as Node)) {
        cancelEdit();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isEditing]);

  function handleRemoveWithConfirm() {
    if (onRemove) {
      setShowRemoveDialog(true);
    }
  }

  function handleConfirmRemove() {
    setShowRemoveDialog(false);
    setIsRemoving(true);
    // Match the animation duration below. Kept as a setTimeout (rather than onAnimationEnd)
    // because the animation classes apply to the outer wrapper and onAnimationEnd can
    // fire from nested animated children.
    window.setTimeout(() => {
      onRemove?.();
    }, 800);
  }

  const dayIndicator = !isHero ? getDayIndicator(time, heroDate) : null;
  // Region-free label for menu/dialog copy; falls back to the qualified name if not supplied.
  const shortName = cityShortName ?? cityName;

  if (isHero) {
    return (
      <div className="hero-clock px-[10px] flex flex-col gap-[2px] sm:gap-0">
        <div>
          <div className="flex-1 min-w-0 flex flex-col gap-[2px] sm:gap-0">
            <p
              className="h-[20px] text-[14px] leading-[20px] font-medium uppercase tracking-[0.35px] text-muted-foreground"
              data-testid="text-hero-city"
            >
              {cityName}
            </p>
            {isEditing ? (
              <div ref={editContainerRef} className="hero-edit relative">
                {/* Desktop edit */}
                <div className="hidden sm:flex w-full items-center gap-[10px] border border-[#c4c7cc] rounded-[12px] pl-[20px] pr-[25px] py-[10px]">
                  <input
                    type="time"
                    step={FIVE_MINUTES_S}
                    value={editTime}
                    onChange={(e) => setEditTime(e.target.value)}
                    onKeyDown={handleEditKeyDown}
                    className="font-display text-[48px] font-black leading-normal bg-transparent border-none outline-none appearance-none p-0 flex-1 min-w-0 [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-inner-spin-button]:hidden [&::-webkit-datetime-edit-fields-wrapper]:p-0"
                    autoFocus
                    data-testid="input-edit-time"
                  />
                  <button
                    onClick={handleUpdateClick}
                    className="bg-[#4e82ee] rounded-[6px] px-[12px] pt-[6px] pb-[7px] text-white font-semibold text-sm leading-[21px] tracking-[-0.1px] shrink-0"
                    data-testid="button-update-clock"
                  >
                    OK
                  </button>
                </div>
                {/* Mobile edit */}
                <div className="flex sm:hidden w-full items-center justify-between gap-[10px] border border-[#c4c7cc] rounded-[10px] pl-[13px] pr-[11px] py-[10px]">
                  <input
                    type="time"
                    step={FIVE_MINUTES_S}
                    value={editTime}
                    onChange={(e) => setEditTime(e.target.value)}
                    onKeyDown={handleEditKeyDown}
                    className="font-display text-[28px] font-black leading-normal bg-transparent border-none outline-none appearance-none p-0 min-w-0 w-[170px] [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-inner-spin-button]:hidden [&::-webkit-datetime-edit-fields-wrapper]:p-0"
                    autoFocus
                  />
                  <button
                    onClick={handleUpdateClick}
                    className="bg-[#4e82ee] rounded-[6px] px-[12px] pt-[6px] pb-[7px] text-white font-semibold text-sm leading-[21px] tracking-[-0.1px] shrink-0"
                  >
                    OK
                  </button>
                </div>
              </div>
            ) : (
              // Size, leading and tracking all scale with --hero-ratio as the page scrolls;
              // the values and the breakpoint live in index.css under .hero-time.
              // w-fit is load-bearing: as a block child of a flex column this <p> would otherwise
              // stretch the full column width, putting its click target under the drawer icon —
              // so a tap that just missed the icon opened the time editor instead.
              <p
                className="hero-time w-fit font-display font-black text-foreground cursor-pointer hover:text-primary transition-colors whitespace-nowrap"
                onClick={handleTimeClick}
                title="Click to edit time"
                data-testid="text-hero-time"
              >
                <span>{timeString}</span>
                {!use24Hour && <span className="hero-time__ampm">{` ${amPm}`}</span>}
              </p>
            )}
          </div>
        </div>
        <div
          className="flex items-center justify-between h-[28px]"
          data-testid="text-hero-timezone"
        >
          <p className="hero-meta text-muted-foreground">
            {timezone}
            {!isCustomMode && weather && (
              <span className={`ml-2 ${getTemperatureColor(weather.celsius)}`} data-testid="text-hero-temperature">
                {weather.fahrenheit}°F / {weather.celsius}°C
              </span>
            )}
            {!isCustomMode && !weather && weatherUnavailable && (
              <span className="ml-2 text-[8px] font-semibold uppercase text-[#6b7280] tracking-[0.2px] whitespace-nowrap align-middle" data-testid="text-hero-weather-unavailable">
                Weather Unavailable
              </span>
            )}
          </p>
          {isCustomMode && onReset && (
            <button
              onClick={onReset}
              className="font-semibold text-sm uppercase text-[#4e82ee] px-2.5 py-[3px] cursor-pointer hover:opacity-80 transition-opacity"
              data-testid="button-reset-time"
            >
              Reset Time
            </button>
          )}
        </div>
      </div>
    );
  }

  // Grid layout (only layout now)
  return (
    <>
    {/* border-transparent on the base reserves 1px of border space in every state, so swapping in a
        colored border doesn't grow the tile or nudge its contents — active states change the border
        color only.

        cn() is load-bearing here, not tidiness. `border-transparent` and a state's `border-[…]` have
        identical specificity, so plain string interpolation leaves CSS source order to decide the
        winner — and Tailwind emits `border-transparent` last. Every colored border below was
        therefore dead, and the tile had no visible border in any state. (Select mode looked like it
        did, but that was an inset ring standing in for the border that never painted; the ring also
        let the fill bleed through the transparent border, reading as a second, paler stroke.)
        twMerge drops the loser instead of leaving it to the stylesheet's ordering. */}
    <div
      className={cn(
        "relative rounded-[15px] px-2.5 pt-0.5 pb-3 border border-transparent",
        isRemoving && "animate-out fade-out-0 zoom-out-95 [animation-duration:800ms] pointer-events-none",
        isDragActive ? "transition-none" : "transition-[background-color,border-color,box-shadow] duration-300 ease-out",
        isSelectMode
          ? pinHoverSkin
            // Sharing View: every tile wears the hover skin at rest, so nothing here reads as
            // "not chosen" — the check does that. Locked tiles aren't pointers (nothing to press);
            // blocked ones say so rather than looking pressable and ignoring the press.
            ? cn(HOVER_SKIN, isLocked ? "" : isBlocked ? "cursor-not-allowed" : "cursor-pointer")
            : isSelected
              ? "bg-[var(--tile-sel-bg)] border-[var(--tile-sel-border)] cursor-pointer"
              : "cursor-pointer"
          : isBeingDragged
          ? "bg-[#fdf19d] dark:bg-[#4a4020] border-[#ffedbd] dark:border-[#5c4f2a] shadow-[0_1px_2px_rgba(0,0,0,0.15)]"
          : isDropdownOpen
            ? "bg-[#fdf7ca] dark:bg-[#3d3520] border-[#ffedbd] dark:border-[#5c4f2a]"
            : isDragActive
              ? "shadow-none bg-transparent"
              : isHighlighted
                ? "animate-highlight-yellow"
                : isNew
                  ? "animate-highlight-yellow"
                  // Same colours as HOVER_SKIN, but only on real hover-capable pointers — a
                  // touch device would otherwise stick the tint on after a tap.
                  : "[@media(hover:hover)]:hover:bg-[#f0f0f0] [@media(hover:hover)]:dark:hover:bg-[#2a2a2a]"
      )}
      data-testid={`clock-tile-${selectedZoneKey}`}
    >
      {/* Share select-mode: a full-tile tap layer toggles inclusion and makes the tile's
          inner controls inert. The check indicator itself lives in the ellipsis's flow slot
          (below) so the tile geometry is identical to normal mode. Gated on onToggleSelect so the
          register-mode preview (signed-out Sharing View — display-only, no toggle) doesn't lay a
          dead, focusable button over every tile. */}
      {isSelectMode && !isLocked && onToggleSelect && (
        <button
          type="button"
          className="absolute inset-0 z-20 rounded-[15px]"
          onClick={() => selectedZoneKey && onToggleSelect?.(selectedZoneKey)}
          data-no-drag
          aria-pressed={isSelected}
          // Still rendered and focusable when blocked — removing it would make the tile
          // undiscoverable rather than merely unavailable — but announced as disabled, since
          // pressing it does nothing until room is freed elsewhere.
          aria-disabled={isBlocked || undefined}
          aria-label={`${isSelected ? "Remove" : "Add"} ${shortName} ${isSelected ? "from" : "to"} share`}
          data-testid={`button-select-${selectedZoneKey}`}
        />
      )}
      {/* Touch-only drag-handle overlay: a 30px-wide full-height invisible
          strip pinned to the tile's left edge. Carries data-drag-handle +
          dragHandleListeners so HandleTouchSensor activates from anywhere
          in this zone (matches the visible grip's position). Kept out of
          the flex row so it doesn't consume layout width — the city-name
          column stays at its pre-fix breathing room. Desktop doesn't need
          this because DesktopMouseSensor drags from the whole tile. */}
      {isDraggable && (
        <div
          className="absolute inset-y-0 left-0 w-[30px] hidden [@media(pointer:coarse)]:block"
          {...(dragHandleListeners as React.HTMLAttributes<HTMLDivElement>)}
          data-drag-handle
          aria-hidden="true"
        />
      )}
      <div className="flex items-start gap-2" ref={isEditing ? editContainerRef : undefined}>
        {/* Visible grip — pure visual affordance. Desktop drag is handled
            by the tile-wrapper mouse sensor; touch drag is handled by the
            invisible overlay above. In select mode the grip is hidden but its
            slot is kept (invisible) so the row geometry doesn't shift. */}
        {(isDraggable || isSelectMode || reserveGripSlot) && (
          <div
            className={`flex-shrink-0 flex items-start justify-center pt-[12px] pr-1 text-muted-foreground/40 transition-colors ${
              // Only a real drag handle is interactive; select mode and the Sharing View's resting
              // tiles keep the slot purely to hold the row's geometry, so they render it invisible.
              isSelectMode || reserveGripSlot
                ? "invisible"
                : "hover:text-muted-foreground cursor-grab active:cursor-grabbing"
            }`}
            title="Drag to reorder"
            aria-hidden={isSelectMode || reserveGripSlot || undefined}
          >
            <GripVertical className="h-4 w-4" />
          </div>
        )}

        {/* City name + timezone (left side) */}
        <div className="flex-1 min-w-0">
          {/* Mobile: city name + time side by side, full content width */}
          <div className="flex items-start justify-between gap-2 sm:block">
            <div className={`min-w-0 flex-1 sm:flex-none ${isEditing ? "truncate" : "overflow-hidden"}`}>
              {isSelectable && selectedZoneKey && onZoneChange ? (
                <div data-no-drag>
                  <CitySelector
                    selectedCityKey={selectedZoneKey}
                    onCityChange={onZoneChange}
                    onOpenChange={setIsDropdownOpen}
                  />
                </div>
              ) : (
                <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground whitespace-nowrap text-ellipsis overflow-hidden py-2">
                  {cityName}
                </p>
              )}
            </div>

            {/* Mobile time (moved here from outside to give city name full width) */}
            {!isEditing && (
              <div className="flex items-start gap-2 pt-[5px] sm:hidden shrink-0">
                <p
                  className={`font-display font-black leading-7 tracking-tight text-foreground cursor-pointer transition-colors ${isDragActive ? "" : "[@media(hover:hover)]:hover:text-primary"}`}
                  onClick={handleTimeClick}
                  title="Click to edit time"
                  data-no-drag
                >
                  <span className="text-2xl">{timeString}</span>
                  {!use24Hour && <span className="text-[16px]">{` ${amPm}`}</span>}
                </p>
              </div>
            )}
          </div>

          {/* Desktop: edit UI or time display */}
          {isEditing ? (
            <div className="hidden sm:block">
              <div className="flex w-full items-center gap-[15px] border border-[#c4c7cc] rounded-[8px] pl-[16px] pr-[12px] pt-[11px] pb-[12px] overflow-hidden">
                <input
                  type="time"
                  step={FIVE_MINUTES_S}
                  value={editTime}
                  onChange={(e) => setEditTime(e.target.value)}
                  onKeyDown={handleEditKeyDown}
                  className="font-display text-[24px] font-black leading-[36px] tracking-[-0.6px] [font-variant-numeric:proportional-nums] [font-feature-settings:'zero'_0] bg-transparent border-none outline-none appearance-none p-0 flex-1 min-w-0 [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-inner-spin-button]:hidden [&::-webkit-datetime-edit-fields-wrapper]:p-0"
                  autoFocus
                />
                <button
                  onClick={handleUpdateClick}
                  className="bg-[#4e82ee] rounded-[6px] px-[12px] pt-[6px] pb-[7px] text-white font-semibold text-sm leading-[21px] tracking-[-0.1px] shrink-0"
                >
                  OK
                </button>
              </div>
            </div>
          ) : (
            <div className="hidden sm:block">
              <div className="flex items-center gap-2">
                <p
                  className={`font-display font-black tracking-tight text-foreground cursor-pointer transition-colors ${isDragActive ? "" : "[@media(hover:hover)]:hover:text-primary"}`}
                  onClick={handleTimeClick}
                  title="Click to edit time"
                  data-no-drag
                >
                  <span className="text-[36px] leading-7">{timeString}</span>
                  {!use24Hour && <span className="text-[24px] leading-7">{` ${amPm}`}</span>}
                </p>
              </div>
              <p className={`mt-[10px] text-xs text-muted-foreground flex items-center ${(relativeOffset !== undefined || dayIndicator) ? "gap-[6px]" : "gap-[10px]"}`}>
                <span>{timezone}</span>
                {(relativeOffset !== undefined || dayIndicator) && (
                  <span className="inline-flex items-center justify-center px-[5px] gap-[5px] border border-[#6b7280] rounded-[3px] text-[9px] font-semibold uppercase text-[#6b7280] leading-[16px] whitespace-nowrap shrink-0">
                    {relativeOffset !== undefined && <span className="tracking-[0.2px]">{formatRelativeOffset(relativeOffset)}</span>}
                    {relativeOffset !== undefined && dayIndicator && <span className="bg-[#6b7280] self-stretch w-px shrink-0" />}
                    {dayIndicator && <span className="tracking-[0.2px]">{dayIndicator === "next" ? "Next Day" : "Prev Day"}</span>}
                  </span>
                )}
                {!isCustomMode && weather && (
                  <span className={`${getTemperatureColor(weather.celsius)} whitespace-nowrap`} data-testid={`text-temp-${selectedZoneKey}`}>
                    {weather.fahrenheit}°F / {weather.celsius}°C
                  </span>
                )}
                {!isCustomMode && !weather && weatherUnavailable && (
                  <span className="text-[8px] font-semibold uppercase text-[#6b7280] tracking-[0.2px] whitespace-nowrap">
                    Weather Unavailable
                  </span>
                )}
              </p>
            </div>
          )}

          {/* Mobile: edit UI below city name (full-width) */}
          {isEditing && (
            <div className="sm:hidden">
              <div className="flex w-full items-center gap-[10px] border border-[#c4c7cc] rounded-[8px] pl-[16px] pr-[10px] pt-[9px] pb-[10px] overflow-hidden">
                <input
                  type="time"
                  step={FIVE_MINUTES_S}
                  value={editTime}
                  onChange={(e) => setEditTime(e.target.value)}
                  onKeyDown={handleEditKeyDown}
                  className="font-display text-[18px] font-black leading-[33px] tracking-[-0.6px] [font-variant-numeric:proportional-nums] [font-feature-settings:'zero'_0] bg-transparent border-none outline-none appearance-none p-0 flex-1 min-w-0 [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-inner-spin-button]:hidden [&::-webkit-datetime-edit-fields-wrapper]:p-0"
                  autoFocus
                />
                <button
                  onClick={handleUpdateClick}
                  className="bg-[#4e82ee] rounded-[6px] px-[12px] pt-[6px] pb-[7px] text-white font-semibold text-sm leading-[21px] tracking-[-0.1px] shrink-0"
                >
                  OK
                </button>
              </div>
            </div>
          )}

          {/* Mobile: zone + temp below city name */}
          {!isEditing && (
            <p className={`text-xs text-muted-foreground sm:hidden flex items-center flex-wrap ${(relativeOffset !== undefined || dayIndicator) ? "gap-[6px]" : "gap-[10px]"}`}>
              <span>{timezone}</span>
              {(relativeOffset !== undefined || dayIndicator) && (
                <span className="inline-flex items-center justify-center px-[5px] gap-[5px] border border-[#6b7280] rounded-[3px] text-[9px] font-semibold uppercase text-[#6b7280] leading-[16px] whitespace-nowrap shrink-0">
                  {relativeOffset !== undefined && <span className="tracking-[0.2px]">{formatRelativeOffset(relativeOffset)}</span>}
                  {relativeOffset !== undefined && dayIndicator && <span className="bg-[#6b7280] self-stretch w-px shrink-0" />}
                  {dayIndicator && <span className="tracking-[0.2px]">{dayIndicator === "next" ? "Next Day" : "Prev Day"}</span>}
                </span>
              )}
              {!isCustomMode && weather && (
                <span className={`${getTemperatureColor(weather.celsius)} whitespace-nowrap`}>
                  {weather.fahrenheit}°F / {weather.celsius}°C
                </span>
              )}
              {!isCustomMode && !weather && weatherUnavailable && (
                <span className="text-[8px] font-semibold uppercase text-[#6b7280] tracking-[0.2px] whitespace-nowrap">
                  Weather Unavailable
                </span>
              )}
            </p>
          )}
        </div>

        {/* Select mode: a check indicator occupies the ellipsis's exact slot (same padding/size),
            so replacing the menu with it never shifts the row. pointer-events-none — the tap lands
            on the full-tile overlay above. */}
        {isSelectMode && (
          <div
            className="flex-shrink-0 flex items-center justify-center py-[11px] px-[5px] pointer-events-none"
            aria-hidden="true"
            data-testid={`select-check-${selectedZoneKey}`}
          >
            {/* Four states, not two. Locked reads as a *settled* fact ("you already have this"),
                so it's a filled check like selected — just muted, because there's no decision to
                make. An empty circle would say "not chosen", which is the opposite of the truth.
                Blocked keeps the empty circle (it genuinely isn't chosen) but fades it, so a tile
                that can't currently be taken doesn't look identical to one that can. */}
            <span
              className={cn(
                "flex h-[17px] w-[17px] items-center justify-center rounded-full transition-colors",
                isLocked
                  ? "bg-foreground/30 text-background"
                  : isSelected
                    ? "bg-foreground text-background"
                    : isBlocked
                      ? "border-[1.5px] border-foreground/15"
                      : "border-[1.5px] border-foreground/40",
                // Keep the 17×17 box (no row shift), paint nothing — the register-mode preview.
                !showSelectCheck && "invisible"
              )}
              data-state={
                isLocked ? "locked" : isSelected ? "selected" : isBlocked ? "blocked" : "unselected"
              }
            >
              {(isSelected || isLocked) && <Check className="h-[11px] w-[11px]" strokeWidth={3} />}
            </span>
          </div>
        )}
        {/* Ellipsis menu — a two-item Share/Delete menu. Hidden in select mode; rendered as
            an invisible placeholder during drag to preserve layout. Share is always present
            (even on the last tile); Delete only when the tile is removable (onRemove set).
            Opening the menu drives isDropdownOpen so the tile shows its active tint. */}
        {!isSelectMode && isBeingDragged && (
          <button
            className="flex-shrink-0 flex items-center justify-center py-[11px] px-[5px] rounded-md text-muted-foreground/50 invisible"
            tabIndex={-1}
            aria-hidden="true"
          >
            <EllipsisCircleIcon />
          </button>
        )}
        {!isSelectMode && !isBeingDragged && (onShare || onSave) && (
          <Popover
            open={isMenuOpen}
            onOpenChange={(o) => {
              setIsMenuOpen(o);
              setIsDropdownOpen(o);
            }}
          >
            <PopoverTrigger asChild>
              <button
                className="flex-shrink-0 flex items-center justify-center py-[11px] px-[5px] rounded-md text-muted-foreground/50 hover:text-foreground transition-colors touch-manipulation"
                onClick={(e) => e.stopPropagation()}
                title="Options"
                data-no-drag
                data-testid={`button-tile-menu-${selectedZoneKey}`}
              >
                <EllipsisCircleIcon />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="share-tile-menu w-[307px] p-1.5 rounded-[10px]">
              {/* Sharing View resting state: the only item. A city the recipient already owns can't
                  be added again, so its item states that fact and is inert — it just closes the menu.
                  Otherwise "Save {city}" re-enters Select Mode with this city checked. */}
              {onSave &&
                (isLocked ? (
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 h-11 px-3 rounded-[7px] text-[15px] font-medium text-muted-foreground cursor-default"
                    onClick={() => {
                      setIsMenuOpen(false);
                      setIsDropdownOpen(false);
                    }}
                    data-testid={`menu-already-saved-${selectedZoneKey}`}
                  >
                    <Check className="h-[18px] w-[18px] shrink-0" />
                    <span className="truncate">Already saved</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 h-11 px-3 rounded-[7px] text-[15px] font-medium text-popover-foreground hover:bg-muted transition-colors"
                    onClick={() => {
                      // See the note below: unmounting order forces resetting both flags here too.
                      setIsMenuOpen(false);
                      setIsDropdownOpen(false);
                      if (selectedZoneKey) onSave(selectedZoneKey);
                    }}
                    data-testid={`menu-save-${selectedZoneKey}`}
                  >
                    <Plus className="h-[18px] w-[18px] shrink-0" />
                    <span className="truncate">Save {shortName}</span>
                  </button>
                ))}
              {onShare && (
                <button
                  type="button"
                  className="flex w-full items-center gap-3 h-11 px-3 rounded-[7px] text-[15px] font-medium text-popover-foreground hover:bg-muted transition-colors"
                  onClick={() => {
                    // Reset both the menu's open flag AND isDropdownOpen: flipping into select mode
                    // unmounts this Popover before Radix fires onOpenChange, which would otherwise
                    // leave isDropdownOpen stuck true and paint a phantom tint after Cancel.
                    setIsMenuOpen(false);
                    setIsDropdownOpen(false);
                    if (selectedZoneKey) onShare(selectedZoneKey);
                  }}
                  data-testid={`menu-share-${selectedZoneKey}`}
                >
                  <Share className="h-[18px] w-[18px] shrink-0" />
                  <span className="truncate">Share {shortName}</span>
                </button>
              )}
              {onRemove && (
                <>
                  <div className="my-1 mx-1 h-px bg-border/70" />
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 h-11 px-3 rounded-[7px] text-[15px] font-medium text-destructive hover:bg-muted transition-colors"
                    onClick={() => {
                      setIsMenuOpen(false);
                      handleRemoveWithConfirm();
                    }}
                    data-testid={`menu-delete-${selectedZoneKey}`}
                  >
                    <Trash2 className="h-[18px] w-[18px] shrink-0" />
                    <span className="truncate">Remove {shortName}</span>
                  </button>
                </>
              )}
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
    <Dialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Happyhour</DialogTitle>
          <DialogDescription>
            Remove {shortName}?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <button
            type="button"
            onClick={() => setShowRemoveDialog(false)}
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
            data-testid="button-remove-cancel"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirmRemove}
            autoFocus
            className="inline-flex items-center justify-center rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors"
            data-testid="button-remove-confirm"
          >
            Remove
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
