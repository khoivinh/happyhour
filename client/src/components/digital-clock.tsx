import React, { useState, useRef, useEffect } from "react";
import { GripVertical, X, Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/theme-toggle";
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
          className="flex items-center gap-1 text-sm font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors focus:outline-none py-2 touch-manipulation"
          data-testid="button-city-selector"
        >
          {selectedCity?.name || "Select city"}
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
}: DigitalClockProps) {
  const hours = time.getHours().toString().padStart(2, "0");
  const minutes = time.getMinutes().toString().padStart(2, "0");
  const seconds = time.getSeconds().toString().padStart(2, "0");

  const timeString = showSeconds ? `${hours}:${minutes}:${seconds}` : `${hours}:${minutes}`;

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTime, setEditTime] = useState("");
  const editContainerRef = useRef<HTMLDivElement>(null);

  // Fetch weather data for this timezone
  const { data: weather } = useWeather(zoneKey || selectedZoneKey);

  function handleTimeClick() {
    if (onTimeUpdate && zoneKey) {
      const currentTime = `${hours}:${minutes}`;
      setEditTime(currentTime);
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
      <div className="px-[10px]">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p
              className="text-sm font-medium uppercase tracking-wide text-muted-foreground"
              data-testid="text-hero-city"
            >
              {cityName}
            </p>
            {isEditing ? (
              <div className="mt-1 flex items-center gap-4 flex-wrap" ref={editContainerRef}>
                <Input
                  type="time"
                  value={editTime}
                  onChange={(e) => setEditTime(e.target.value)}
                  className="font-display text-4xl font-black h-auto py-2 px-3 w-48"
                  autoFocus
                  data-testid="input-edit-time"
                />
                <Button onClick={handleUpdateClick} data-testid="button-update-clock">
                  Update Clock
                </Button>
              </div>
            ) : (
              <p
                className="mt-1 font-display text-[60px] font-black tracking-tight text-foreground leading-[60px] md:text-8xl md:leading-[96px] cursor-pointer hover:text-primary transition-colors min-h-[60px] md:min-h-[96px]"
                onClick={handleTimeClick}
                title="Click to edit time"
                data-testid="text-hero-time"
              >
                {timeString}
              </p>
            )}
          </div>
          <ThemeToggle />
        </div>
        <div
          className="mt-2 flex items-center justify-between h-[28px]"
          data-testid="text-hero-timezone"
        >
          <p className="text-sm text-muted-foreground">
            {timezone}
            {weather && (
              <span className={`ml-2 ${getTemperatureColor(weather.celsius)}`} data-testid="text-hero-temperature">
                {weather.fahrenheit}°F / {weather.celsius}°C
              </span>
            )}
          </p>
          {isCustomMode && onReset && (
            <button
              onClick={onReset}
              className="font-semibold text-sm uppercase text-[#4e82ee] px-2.5 py-[7px] cursor-pointer hover:opacity-80 transition-opacity"
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
            <p className={`text-xs text-muted-foreground sm:hidden flex items-center ${dayIndicator ? "gap-[6px]" : "gap-[10px]"}`}>
              <span>{timezone}</span>
              {dayIndicator && (
                <span className="inline-flex items-center justify-center px-[5px] border border-[#6b7280] rounded-[3px] text-[7px] font-bold uppercase text-[#6b7280] leading-[15px]">
                  {dayIndicator === "next" ? "Next Day" : "Prev Day"}
                </span>
              )}
              {weather && (
                <span className={getTemperatureColor(weather.celsius)}>
                  {weather.fahrenheit}°F / {weather.celsius}°C
                </span>
              )}
            </p>
          )}
        </div>

        {/* Time (right side on mobile) */}
        {isEditing ? (
          <div className="flex items-start shrink-0 sm:hidden">
            <div className="flex items-start gap-[10px] border border-[#c4c7cc] rounded-[8px] pl-[16px] pr-[10px] pt-[9px] pb-[10px] bg-transparent">
              <Input
                type="time"
                value={editTime}
                onChange={(e) => setEditTime(e.target.value)}
                className="font-display text-2xl font-black h-auto p-0 border-0 shadow-none focus-visible:ring-0 w-[72px] leading-[33px] tracking-[-0.6px] bg-transparent [&::-webkit-calendar-picker-indicator]:hidden"
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

      {/* Desktop: time and timezone below the top row */}
      <div className="hidden sm:block pl-7">
        {isEditing ? (
          <div className="mt-1">
            <div className="flex items-start gap-[15px] border border-[#c4c7cc] rounded-[8px] pl-[16px] pr-[12px] pt-[11px] pb-[12px] w-full bg-transparent">
              <Input
                type="time"
                value={editTime}
                onChange={(e) => setEditTime(e.target.value)}
                className="font-display text-[36px] font-black h-auto p-0 border-0 shadow-none focus-visible:ring-0 flex-1 leading-[36px] tracking-[-0.6px] bg-transparent [&::-webkit-calendar-picker-indicator]:hidden"
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
          <div className="flex items-center gap-2">
            <p
              className={`font-display text-[36px] font-black leading-7 tracking-tight text-foreground cursor-pointer transition-colors ${isDragActive ? "" : "[@media(hover:hover)]:hover:text-primary"}`}
              onClick={handleTimeClick}
              title="Click to edit time"
            >
              {timeString}
            </p>
          </div>
        )}
        {!isEditing && (
          <p className={`mt-[15px] text-xs text-muted-foreground flex items-center ${dayIndicator ? "gap-[6px]" : "gap-[10px]"}`}>
            <span>{timezone}</span>
            {dayIndicator && (
              <span className="inline-flex items-center justify-center px-[5px] border border-[#6b7280] rounded-[3px] text-[7px] font-bold uppercase text-[#6b7280] leading-[15px]">
                {dayIndicator === "next" ? "Next Day" : "Prev Day"}
              </span>
            )}
            {weather && (
              <span className={getTemperatureColor(weather.celsius)} data-testid={`text-temp-${selectedZoneKey}`}>
                {weather.fahrenheit}°F / {weather.celsius}°C
              </span>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
