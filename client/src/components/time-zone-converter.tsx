import { useState, useEffect, useCallback } from "react";
import { LayoutGrid, List, Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DigitalClock } from "@/components/digital-clock";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  DragCancelEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { ALL_CITIES, getCityByKey, searchCities, getTimeInCityZone } from "@/lib/city-lookup";

interface TimeZoneConverterProps {
  isCustomMode: boolean;
  selectedTime: Date | null;
  onTimeUpdate: (zoneKey: string, hours: number, minutes: number) => void;
}

interface SortableClockItemProps {
  id: string;
  zoneKey: string;
  index: number;
  baseTime: Date;
  layout: "grid" | "list";
  isNew: boolean;
  onZoneChange: (index: number, zoneKey: string) => void;
  otherZoneKeys: string[];
  onTimeUpdate: (zoneKey: string, hours: number, minutes: number) => void;
  onRemove: (zoneKey: string) => void;
  allZones: string[];
  isDragActive: boolean;
}

function SortableClockItem({
  id,
  zoneKey,
  index,
  baseTime,
  layout,
  isNew,
  onZoneChange,
  otherZoneKeys,
  onTimeUpdate,
  onRemove,
  allZones,
  isDragActive,
}: SortableClockItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    active,
    over,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const city = getCityByKey(zoneKey);

  // Calculate indicator position based on drag direction
  const activeIndex = active ? allZones.indexOf(active.id as string) : -1;
  const overIndex = over ? allZones.indexOf(over.id as string) : -1;
  const isBeingHoveredOver = over?.id === id && active?.id !== id;
  
  // Show indicator on the side where the item will be inserted
  const showBeforeIndicator = isBeingHoveredOver && activeIndex > overIndex;
  const showAfterIndicator = isBeingHoveredOver && activeIndex < overIndex;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`relative cursor-grab active:cursor-grabbing touch-manipulation`}
      data-testid={`draggable-zone-${zoneKey}`}
    >
      {showBeforeIndicator && (
        layout === "grid" ? (
          <div className="absolute -left-4 top-0 bottom-0 w-1 bg-primary rounded-full" />
        ) : (
          <div className="absolute -top-2 left-0 right-0 h-1 bg-primary rounded-full" />
        )
      )}
      {showAfterIndicator && (
        layout === "grid" ? (
          <div className="absolute -right-4 top-0 bottom-0 w-1 bg-primary rounded-full" />
        ) : (
          <div className="absolute -bottom-2 left-0 right-0 h-1 bg-primary rounded-full" />
        )
      )}

      <DigitalClock
        time={city ? getTimeInCityZone(baseTime, city.offset) : baseTime}
        cityName={city?.name || zoneKey}
        timezone={city?.gmtLabel || ""}
        isSelectable
        selectedZoneKey={zoneKey}
        onZoneChange={(newZone) => onZoneChange(index, newZone)}
        otherZoneKeys={otherZoneKeys}
        isNew={isNew}
        isDraggable
        isBeingDragged={isDragging}
        layout={layout}
        zoneKey={zoneKey}
        onTimeUpdate={onTimeUpdate}
        onRemove={() => onRemove(zoneKey)}
        isDragActive={isDragActive}
      />
    </div>
  );
}

const MAX_CLOCKS = 12;
const STORAGE_KEY = "world-clock-zones";

function detectLocalCity(): string {
  try {
    const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const match = ALL_CITIES.find(c => c.timezone === localTz);
    return match?.key || "london_GB";
  } catch {
    return "london_GB";
  }
}

// Migration: convert old city keys to new format with country code
function migrateOldKeys(keys: string[]): string[] {
  const oldToNew: Record<string, string> = {
    "paris": "paris_FR",
    "newYork": "newYork_US",
    "losAngeles": "losAngeles_US",
    "london": "london_GB",
    "tokyo": "tokyo_JP",
    "sydney": "sydney_AU",
    "dubai": "dubai_AE",
    "singapore": "singapore_SG",
    "hongKong": "hongKong_HK",
    "berlin": "berlin_DE",
    "moscow": "moscow_RU",
    "mumbai": "mumbai_IN",
    "shanghai": "shanghai_CN",
    "beijing": "beijing_CN",
    "seoul": "seoul_KR",
    "bangkok": "bangkok_TH",
    "cairo": "cairo_EG",
    "istanbul": "istanbul_TR",
  };
  
  return keys.map(key => {
    // If already in new format (contains underscore), keep as is
    if (key.includes("_")) return key;
    // If old format, migrate to new
    return oldToNew[key] || key;
  }).filter(key => getCityByKey(key) !== undefined);
}

const DEFAULT_ZONES = ["paris_FR", "newYork_US", "losAngeles_US"];

export function TimeZoneConverter({ isCustomMode, selectedTime, onTimeUpdate }: TimeZoneConverterProps) {
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [selectedZones, setSelectedZones] = useState<string[]>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        const migrated = migrateOldKeys(parsed);
        return migrated.length > 0 ? migrated : DEFAULT_ZONES;
      } catch {
        return DEFAULT_ZONES;
      }
    }
    return DEFAULT_ZONES;
  });
  const [heroZone, setHeroZone] = useState<string>("london_GB");
  const [newlyAddedZone, setNewlyAddedZone] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [layout, setLayout] = useState<"grid" | "list">("grid");

  // Mobile-optimized sensors: use TouchSensor with delay for mobile to prevent
  // accidental drags while scrolling, and PointerSensor for desktop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 10, // Slightly larger distance for desktop
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200, // 200ms hold before drag starts on mobile
        tolerance: 8, // Allow 8px movement during delay without canceling
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    const localCity = detectLocalCity();
    setHeroZone(localCity);
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedZones));
  }, [selectedZones]);

  useEffect(() => {
    if (isCustomMode) return;

    setCurrentTime(new Date());

    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, [isCustomMode]);

  const handleZoneChange = useCallback((index: number, zoneKey: string) => {
    setSelectedZones((prev) => {
      const newZones = [...prev];
      newZones[index] = zoneKey;
      return newZones;
    });
  }, []);

  const handleAddClock = useCallback((zoneKey: string) => {
    if (selectedZones.length >= MAX_CLOCKS) return;
    if (selectedZones.includes(zoneKey)) return;

    setSelectedZones((prev) => [zoneKey, ...prev]);
    setNewlyAddedZone(zoneKey);

    setTimeout(() => {
      setNewlyAddedZone(null);
    }, 1500);
  }, [selectedZones]);

  const handleRemoveClock = useCallback((zoneKey: string) => {
    setSelectedZones((prev) => prev.filter((z) => z !== zoneKey));
  }, []);

  const [addZoneOpen, setAddZoneOpen] = useState(false);
  const [addZoneSearchQuery, setAddZoneSearchQuery] = useState("");
  
  const filteredCitiesToAdd = searchCities(addZoneSearchQuery, 100)
    .filter((city) => !selectedZones.includes(city.key));

  const canAddMoreZones = selectedZones.length < MAX_CLOCKS;

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    
    setActiveId(null);

    if (over && active.id !== over.id) {
      setSelectedZones((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }

  function handleDragCancel(_event: DragCancelEvent) {
    setActiveId(null);
  }

  function getBaseTime(): Date {
    if (isCustomMode && selectedTime) {
      return selectedTime;
    }
    // Return the current time directly - getTimeInCityZone handles timezone conversion
    return currentTime || new Date();
  }

  function getOtherZoneKeys(currentIndex: number): string[] {
    return selectedZones.filter((_, index) => index !== currentIndex);
  }

  if (!currentTime && !isCustomMode) {
    const heroCity = getCityByKey(heroZone);
    return (
      <div className="space-y-16">
        <section>
          <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            {heroCity?.name || heroZone}
          </p>
          <p className="mt-1 font-display text-6xl font-black tracking-tight text-foreground md:text-8xl">
            --:--:--
          </p>
          <p className="mt-2 text-sm text-muted-foreground">{heroCity?.gmtLabel}</p>
        </section>

        <section className="border-t border-border pt-12">
          <div className="mb-8">
            <span className="text-sm text-muted-foreground">Loading...</span>
          </div>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {selectedZones.map((zoneKey) => {
              const city = getCityByKey(zoneKey);
              return (
                <div key={zoneKey}>
                  <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                    {city?.name || zoneKey}
                  </p>
                  <p className="mt-1 font-display text-3xl font-black tracking-tight text-foreground md:text-4xl">
                    --:--
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{city?.gmtLabel}</p>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    );
  }

  const baseTime = getBaseTime();
  const heroCity = getCityByKey(heroZone);
  const activeCity = activeId ? getCityByKey(activeId) : null;

  return (
    <div className="space-y-16">
      <section>
        <DigitalClock
          time={heroCity ? getTimeInCityZone(baseTime, heroCity.offset) : baseTime}
          cityName={heroCity?.name || heroZone}
          timezone={heroCity?.gmtLabel || ""}
          isHero
          showSeconds={!isCustomMode}
          zoneKey={heroZone}
          onTimeUpdate={onTimeUpdate}
        />
      </section>

      <section className="border-t border-border pt-6">
        <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <Popover open={addZoneOpen} onOpenChange={(open) => {
              setAddZoneOpen(open);
              if (!open) setAddZoneSearchQuery("");
            }}>
              <PopoverTrigger asChild>
                <button
                  className="flex items-center gap-1 text-sm font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors focus:outline-none disabled:opacity-50"
                  disabled={!canAddMoreZones}
                  data-testid="button-add-timezone"
                >
                  Add Time Zone
                  <ChevronsUpDown className="h-3 w-3 opacity-50" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-[280px] p-0" align="start" collisionPadding={20}>
                <Command shouldFilter={false}>
                  <CommandInput 
                    placeholder="Search cities..." 
                    value={addZoneSearchQuery}
                    onValueChange={setAddZoneSearchQuery}
                    data-testid="input-add-zone-search"
                  />
                  <CommandList>
                    <CommandEmpty>No cities found.</CommandEmpty>
                    <CommandGroup>
                      {filteredCitiesToAdd.map((city) => (
                        <CommandItem
                          key={city.key}
                          value={city.key}
                          onSelect={() => {
                            handleAddClock(city.key);
                            setAddZoneOpen(false);
                            setAddZoneSearchQuery("");
                          }}
                          data-testid={`menu-item-${city.key}`}
                        >
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
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm uppercase text-muted-foreground">View</span>
            <Button
              variant={layout === "grid" ? "default" : "ghost"}
              size="icon"
              onClick={() => setLayout("grid")}
              className="h-8 w-8 rounded-full"
              title="Grid view"
              data-testid="button-grid-view"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={layout === "list" ? "default" : "ghost"}
              size="icon"
              onClick={() => setLayout("list")}
              className="h-8 w-8 rounded-full"
              title="List view"
              data-testid="button-list-view"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <SortableContext 
            items={selectedZones} 
            strategy={layout === "grid" ? rectSortingStrategy : verticalListSortingStrategy}
          >
            <div className={layout === "grid" ? "grid grid-cols-1 gap-8 md:grid-cols-3" : "flex flex-col gap-4"}>
              {selectedZones.map((zoneKey, index) => (
                <SortableClockItem
                  key={zoneKey}
                  id={zoneKey}
                  zoneKey={zoneKey}
                  index={index}
                  baseTime={baseTime}
                  layout={layout}
                  isNew={newlyAddedZone === zoneKey}
                  onZoneChange={handleZoneChange}
                  otherZoneKeys={getOtherZoneKeys(index)}
                  onTimeUpdate={onTimeUpdate}
                  onRemove={handleRemoveClock}
                  allZones={selectedZones}
                  isDragActive={activeId !== null}
                />
              ))}
            </div>
          </SortableContext>

          <DragOverlay>
            {activeId && activeCity ? (
              <div className="opacity-90 shadow-xl">
                <DigitalClock
                  time={getTimeInCityZone(baseTime, activeCity.offset)}
                  cityName={activeCity.name}
                  timezone={activeCity.gmtLabel}
                  isSelectable={false}
                  isDraggable
                  isBeingDragged
                  layout={layout}
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </section>
    </div>
  );
}
