import React, { useState, useRef, useEffect } from "react";
import { GripVertical, Check, ChevronsUpDown } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { ALL_CITIES, getCityByKey, searchCities, type TimezoneOption } from "@/lib/city-lookup";
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

interface DigitalClockProps {
  time: Date;
  cityName: string;
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
  isDragActive?: boolean;
  dragHandleListeners?: Record<string, unknown>;
  heroDate?: Date;
  isCustomMode?: boolean;
  onReset?: () => void;
  use24Hour?: boolean;
}

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
  const filteredCities = searchCities(searchValue, 100);

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
      <PopoverContent className="w-[280px] p-0" align="start" collisionPadding={20}>
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search cities..."
            value={searchValue}
            onValueChange={setSearchValue}
            data-testid="input-city-search"
          />
          <CommandList>
            <CommandEmpty>No cities found.</CommandEmpty>
            <CommandGroup>
              {filteredCities.map((city) => (
                <CommandItem
                  key={city.key}
                  value={city.key}
                  onSelect={() => {
                    onCityChange(city.key);
                    setOpen(false);
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
                      {city.country} ({city.gmtLabel})
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
  isDragActive = false,
  dragHandleListeners,
  heroDate,
  isCustomMode = false,
  onReset,
  use24Hour = true,
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
      ? `${displayHours}:${minutes}:${seconds} ${amPm}`
      : `${displayHours}:${minutes} ${amPm}`;
  }

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTime, setEditTime] = useState("");
  const editContainerRef = useRef<HTMLDivElement>(null);

  // Fetch weather data for this timezone
  const { data: weather } = useWeather(zoneKey || selectedZoneKey);

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

  // Close editing when clicking outside
  useEffect(() => {
    if (!isEditing) return;
    function handleClickOutside(e: MouseEvent) {
      if (editContainerRef.current && !editContainerRef.current.contains(e.target as Node)) {
        setIsEditing(false);
        setEditTime("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isEditing]);

  function handleRemoveWithConfirm() {
    if (onRemove && confirm(`Remove ${cityName}?`)) {
      onRemove();
    }
  }

  const dayIndicator = !isHero ? getDayIndicator(time, heroDate) : null;

  if (isHero) {
    return (
      <div className="px-[10px] flex flex-col gap-[2px] sm:gap-0 sm:min-h-[144px]">
        <div>
          <div className="flex-1 min-w-0 flex flex-col gap-[2px] sm:gap-0">
            <p
              className="h-[20px] text-[14px] leading-[20px] font-medium uppercase tracking-[0.35px] text-muted-foreground"
              data-testid="text-hero-city"
            >
              {cityName}
            </p>
            {isEditing ? (
              <div ref={editContainerRef} className="relative">
                {/* Desktop edit */}
                <div className="hidden sm:flex w-full items-center gap-[10px] border border-[#c4c7cc] rounded-[12px] pl-[20px] pr-[25px] py-[10px]">
                  <input
                    type="time"
                    value={editTime}
                    onChange={(e) => setEditTime(e.target.value)}
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
                    value={editTime}
                    onChange={(e) => setEditTime(e.target.value)}
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
              <p
                className="font-display text-[60px] font-black tracking-[-2.4px] text-foreground leading-[60px] md:text-[96px] md:leading-[96px] cursor-pointer hover:text-primary transition-colors whitespace-nowrap"
                onClick={handleTimeClick}
                title="Click to edit time"
                data-testid="text-hero-time"
              >
                {timeString}
              </p>
            )}
          </div>
        </div>
        <div
          className="flex items-center justify-between h-[28px]"
          data-testid="text-hero-timezone"
        >
          <p className="text-sm text-muted-foreground">
            {timezone}
            {!isCustomMode && weather && (
              <span className={`ml-2 ${getTemperatureColor(weather.celsius)}`} data-testid="text-hero-temperature">
                {weather.fahrenheit}°F / {weather.celsius}°C
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
    <div
      className={`relative rounded-[15px] px-2.5 pt-[15px] pb-5
      ${isDragActive ? "transition-none" : "transition-[background-color,box-shadow] duration-300 ease-out"}
      ${
        isBeingDragged
          ? "bg-[#fdf19d] dark:bg-[#4a4020] border border-[#ffedbd] dark:border-[#5c4f2a] shadow-[0_1px_2px_rgba(0,0,0,0.15)]"
          : isDropdownOpen
            ? "bg-[#fdf7ca] dark:bg-[#3d3520] border border-[#ffedbd] dark:border-[#5c4f2a]"
            : isDragActive
              ? "shadow-none bg-transparent"
              : isHighlighted
                ? "animate-highlight-yellow"
                : isNew
                  ? "animate-highlight-yellow"
                  : "[@media(hover:hover)]:hover:bg-[#f0f0f0] [@media(hover:hover)]:dark:hover:bg-[#2a2a2a]"
      }`}
      data-testid={`clock-tile-${selectedZoneKey}`}
    >
      <div className="flex items-start gap-2" ref={isEditing ? editContainerRef : undefined}>
        {/* Drag handle */}
        {isDraggable && (
          <div
            className="flex-shrink-0 flex items-start justify-center pt-2.5 pr-1 text-muted-foreground/40 hover:text-muted-foreground transition-colors cursor-grab active:cursor-grabbing touch-none"
            {...(dragHandleListeners as React.HTMLAttributes<HTMLDivElement>)}
            title="Drag to reorder"
          >
            <GripVertical className="h-4 w-4" />
          </div>
        )}

        {/* City name + timezone (left side) */}
        <div className="flex-1 min-w-0">
          {isSelectable && selectedZoneKey && onZoneChange ? (
            <div className={isEditing ? "truncate" : ""}>
              <CitySelector
                selectedCityKey={selectedZoneKey}
                onCityChange={onZoneChange}
                onOpenChange={setIsDropdownOpen}
              />
            </div>
          ) : (
            <p className={`text-sm font-medium uppercase tracking-wide text-muted-foreground ${isEditing ? "truncate" : ""}`}>
              {cityName}
            </p>
          )}
          {/* Mobile: zone + temp inline below city name (hidden when editing) */}
          {!isEditing && (
            <p className={`text-xs text-muted-foreground sm:hidden flex items-center flex-nowrap overflow-hidden ${dayIndicator ? "gap-[6px]" : "gap-[10px]"}`}>
              <span>{timezone}</span>
              {dayIndicator && (
                <span className="inline-flex items-center justify-center px-[5px] border border-[#6b7280] rounded-[3px] text-[7px] font-bold uppercase text-[#6b7280] leading-[15px] whitespace-nowrap shrink-0">
                  {dayIndicator === "next" ? "Next Day" : "Prev Day"}
                </span>
              )}
              {!isCustomMode && weather && (
                <span className={`${getTemperatureColor(weather.celsius)} truncate`}>
                  {weather.fahrenheit}°F / {weather.celsius}°C
                </span>
              )}
            </p>
          )}

          {/* Desktop: edit UI or time display */}
          {isEditing ? (
            <div className="hidden sm:block">
              <div className="flex w-full items-center gap-[15px] border border-[#c4c7cc] rounded-[8px] pl-[16px] pr-[12px] pt-[11px] pb-[12px] overflow-hidden">
                <input
                  type="time"
                  value={editTime}
                  onChange={(e) => setEditTime(e.target.value)}
                  className="font-display text-[24px] font-black leading-[36px] tracking-[-0.6px] bg-transparent border-none outline-none appearance-none p-0 flex-1 min-w-0 [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-inner-spin-button]:hidden [&::-webkit-datetime-edit-fields-wrapper]:p-0"
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
                  className={`font-display text-[36px] font-black leading-7 tracking-tight text-foreground cursor-pointer transition-colors ${isDragActive ? "" : "[@media(hover:hover)]:hover:text-primary"}`}
                  onClick={handleTimeClick}
                  title="Click to edit time"
                >
                  {timeString}
                </p>
              </div>
              <p className={`mt-[15px] text-xs text-muted-foreground flex items-center ${dayIndicator ? "gap-[6px]" : "gap-[10px]"}`}>
                <span>{timezone}</span>
                {dayIndicator && (
                  <span className="inline-flex items-center justify-center px-[5px] border border-[#6b7280] rounded-[3px] text-[7px] font-bold uppercase text-[#6b7280] leading-[15px]">
                    {dayIndicator === "next" ? "Next Day" : "Prev Day"}
                  </span>
                )}
                {!isCustomMode && weather && (
                  <span className={getTemperatureColor(weather.celsius)} data-testid={`text-temp-${selectedZoneKey}`}>
                    {weather.fahrenheit}°F / {weather.celsius}°C
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
                  value={editTime}
                  onChange={(e) => setEditTime(e.target.value)}
                  className="font-display text-[18px] font-black leading-[33px] tracking-[-0.6px] bg-transparent border-none outline-none appearance-none p-0 flex-1 min-w-0 [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-inner-spin-button]:hidden [&::-webkit-datetime-edit-fields-wrapper]:p-0"
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
        </div>

        {/* Time (right side on mobile) — hidden when editing */}
        {!isEditing && (
          <div className="flex items-start gap-2 pt-[5px] sm:hidden">
            <p
              className={`font-display text-2xl font-black leading-7 tracking-tight text-foreground cursor-pointer transition-colors ${isDragActive ? "" : "[@media(hover:hover)]:hover:text-primary"}`}
              onClick={handleTimeClick}
              title="Click to edit time"
            >
              {timeString}
            </p>
          </div>
        )}

        {/* Ellipsis menu button */}
        {onRemove && (
          <button
            className="flex-shrink-0 flex items-center justify-center py-[11px] px-[5px] rounded-md text-muted-foreground/50 hover:text-foreground transition-colors touch-manipulation"
            onClick={(e) => {
              e.stopPropagation();
              handleRemoveWithConfirm();
            }}
            title="Options"
            data-testid={`button-remove-${selectedZoneKey}`}
          >
            <EllipsisCircleIcon />
          </button>
        )}
      </div>
    </div>
  );
}
