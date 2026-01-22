import { useState } from "react";
import { GripVertical } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MeetingPlannerModal } from "@/components/meeting-planner-modal";
import { ThemeToggle } from "@/components/theme-toggle";
import { ALL_TIMEZONES, type TimezoneKey } from "@shared/schema";
import { useWeather, getTemperatureColor } from "@/hooks/use-weather";

interface DigitalClockProps {
  time: Date;
  cityName: string;
  timezone: string;
  isHero?: boolean;
  showSeconds?: boolean;
  isSelectable?: boolean;
  selectedZoneKey?: TimezoneKey;
  onZoneChange?: (zoneKey: TimezoneKey) => void;
  otherZoneKeys?: TimezoneKey[];
  isNew?: boolean;
  isDraggable?: boolean;
  isBeingDragged?: boolean;
  layout?: "grid" | "list";
  zoneKey?: TimezoneKey;
  onTimeUpdate?: (zoneKey: TimezoneKey, hours: number, minutes: number) => void;
}

function CitySelector({ 
  selectedZoneKey, 
  onZoneChange, 
  onOpenChange 
}: { 
  selectedZoneKey: TimezoneKey;
  onZoneChange: (zoneKey: TimezoneKey) => void;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Select 
      value={selectedZoneKey} 
      onValueChange={(val) => onZoneChange(val as TimezoneKey)} 
      onOpenChange={onOpenChange}
    >
      <SelectTrigger className="w-fit h-auto p-0 border-0 bg-transparent text-sm font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground focus:ring-0 focus:ring-offset-0 gap-1">
        <SelectValue>{ALL_TIMEZONES[selectedZoneKey]?.name}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {Object.entries(ALL_TIMEZONES)
          .filter(([key]) => key !== "london")
          .sort((a, b) => b[1].offset - a[1].offset)
          .map(([key, tz]) => (
            <SelectItem key={key} value={key}>
              {tz.name} ({tz.gmtLabel})
            </SelectItem>
          ))}
      </SelectContent>
    </Select>
  );
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
  otherZoneKeys = [],
  isNew = false,
  isDraggable = false,
  isBeingDragged = false,
  layout = "grid",
  zoneKey,
  onTimeUpdate,
}: DigitalClockProps) {
  const hours = time.getHours().toString().padStart(2, "0");
  const minutes = time.getMinutes().toString().padStart(2, "0");
  const seconds = time.getSeconds().toString().padStart(2, "0");

  const timeString = showSeconds ? `${hours}:${minutes}:${seconds}` : `${hours}:${minutes}`;

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTime, setEditTime] = useState("");

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

  function handleCancelEdit() {
    setIsEditing(false);
    setEditTime("");
  }

  if (isHero) {
    return (
      <div className="flex items-start justify-between">
        <div>
          <p 
            className="text-sm font-medium uppercase tracking-wide text-muted-foreground"
            data-testid="text-hero-city"
          >
            {cityName}
          </p>
          {isEditing ? (
            <div className="mt-1 flex items-center gap-4 flex-wrap">
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
              <Button variant="ghost" onClick={handleCancelEdit} data-testid="button-cancel-edit">
                Cancel
              </Button>
            </div>
          ) : (
            <p
              className="mt-1 font-display text-6xl font-black tracking-tight text-foreground md:text-8xl cursor-pointer hover:text-primary transition-colors"
              onClick={handleTimeClick}
              title="Click to edit time"
              data-testid="text-hero-time"
            >
              {timeString}
            </p>
          )}
          <p 
            className="mt-2 text-sm text-muted-foreground"
            data-testid="text-hero-timezone"
          >
            {timezone}
            {weather && (
              <span className={`ml-2 ${getTemperatureColor(weather.celsius)}`} data-testid="text-hero-temperature">
                {weather.fahrenheit}°F / {weather.celsius}°C
              </span>
            )}
          </p>
        </div>
        <ThemeToggle />
      </div>
    );
  }

  if (layout === "list") {
    return (
      <div
        className={`relative rounded-lg p-4 -m-4 transition-all duration-300 ease-out 
        ${isEditing ? "bg-muted shadow-lg ring-2 ring-primary/20" : isDropdownOpen ? "bg-muted shadow-lg" : "hover:bg-muted hover:shadow-lg"}
        ${isNew ? "animate-highlight-yellow" : ""}
        ${isBeingDragged ? "bg-yellow-200 dark:bg-yellow-800/50 shadow-lg" : ""}`}
        data-testid={`clock-tile-${selectedZoneKey}`}
      >
        <div className="flex items-center gap-6 py-10">
          {isDraggable && (
            <div className="text-muted-foreground/50 hover:text-muted-foreground transition-colors">
              <GripVertical className="h-4 w-4" />
            </div>
          )}

          <div className="w-32">
            {isSelectable && selectedZoneKey && onZoneChange ? (
              <CitySelector 
                selectedZoneKey={selectedZoneKey} 
                onZoneChange={onZoneChange}
                onOpenChange={setIsDropdownOpen}
              />
            ) : (
              <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                {cityName}
              </p>
            )}
          </div>

          {isEditing ? (
            <div className="flex items-center gap-4">
              <Input
                type="time"
                value={editTime}
                onChange={(e) => setEditTime(e.target.value)}
                className="font-display text-3xl font-black h-14 px-4 w-40"
                autoFocus
              />
              <Button onClick={handleUpdateClick}>Update Clock</Button>
              <Button variant="ghost" onClick={handleCancelEdit}>Cancel</Button>
            </div>
          ) : (
            <p
              className="font-display text-6xl font-black tracking-tight text-foreground cursor-pointer hover:text-primary transition-colors"
              onClick={handleTimeClick}
              title="Click to edit time"
            >
              {timeString}
            </p>
          )}

          <p className="text-xs text-muted-foreground">
            {timezone}
            {weather && (
              <span className={`ml-2 ${getTemperatureColor(weather.celsius)}`} data-testid={`text-temp-${selectedZoneKey}`}>
                {weather.fahrenheit}°F / {weather.celsius}°C
              </span>
            )}
          </p>

          {selectedZoneKey && otherZoneKeys.length > 0 && (
            <div className="ml-auto">
              <MeetingPlannerModal hostZoneKey={selectedZoneKey} otherZoneKeys={otherZoneKeys} />
            </div>
          )}
        </div>
      </div>
    );
  }

  // Grid layout
  return (
    <div
      className={`relative rounded-lg p-4 -m-4 mr-4 transition-all duration-300 ease-out 
      ${
        isEditing
          ? "bg-muted shadow-lg ring-2 ring-primary/20"
          : isDropdownOpen
            ? "scale-110 bg-muted shadow-lg -translate-y-1"
            : "hover:scale-110 hover:bg-muted hover:shadow-lg hover:-translate-y-1"
      }
      ${isNew ? "animate-highlight-yellow" : ""}
      ${isBeingDragged ? "bg-yellow-200 dark:bg-yellow-800/50 shadow-lg scale-105" : ""}`}
      data-testid={`clock-tile-${selectedZoneKey}`}
    >
      {isDraggable && (
        <div className="absolute top-4 left-2 text-muted-foreground/50 hover:text-muted-foreground transition-colors">
          <GripVertical className="h-4 w-4" />
        </div>
      )}

      {selectedZoneKey && otherZoneKeys.length > 0 && (
        <div className="absolute top-4 right-2">
          <MeetingPlannerModal hostZoneKey={selectedZoneKey} otherZoneKeys={otherZoneKeys} />
        </div>
      )}

      <div className="pl-6">
        {isSelectable && selectedZoneKey && onZoneChange ? (
          <CitySelector 
            selectedZoneKey={selectedZoneKey} 
            onZoneChange={onZoneChange}
            onOpenChange={setIsDropdownOpen}
          />
        ) : (
          <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            {cityName}
          </p>
        )}

        {isEditing ? (
          <div className="mt-2 space-y-3 pb-2">
            <Input
              type="time"
              value={editTime}
              onChange={(e) => setEditTime(e.target.value)}
              className="font-display text-2xl font-black h-12 px-3 w-full max-w-[140px]"
              autoFocus
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleUpdateClick} className="flex-1">
                Update
              </Button>
              <Button size="sm" variant="ghost" onClick={handleCancelEdit} className="flex-1">
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <p
            className="mt-1 font-display text-3xl font-black tracking-tight text-foreground md:text-4xl cursor-pointer hover:text-primary transition-colors"
            onClick={handleTimeClick}
            title="Click to edit time"
          >
            {timeString}
          </p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">
          {timezone}
          {weather && (
            <span className={`ml-2 ${getTemperatureColor(weather.celsius)}`} data-testid={`text-temp-${selectedZoneKey}`}>
              {weather.fahrenheit}°F / {weather.celsius}°C
            </span>
          )}
        </p>
      </div>
    </div>
  );
}
