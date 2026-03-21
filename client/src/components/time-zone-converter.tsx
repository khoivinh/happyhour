import { useState, useEffect, useCallback, useRef, startTransition } from "react";
import { ChevronsUpDown } from "lucide-react";
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
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ALL_CITIES, getCityByKey, searchCities, getTimeInCityZone } from "@/lib/city-lookup";

interface TimeZoneConverterProps {
  isCustomMode: boolean;
  selectedTime: Date | null;
  onTimeUpdate: (zoneKey: string, hours: number, minutes: number) => void;
  onReset: () => void;
  use24Hour: boolean;
  sortEastToWest: boolean;
  onSortEastToWestChange: (value: boolean) => void;
}

interface SortableClockItemProps {
  id: string;
  zoneKey: string;
  index: number;
  baseTime: Date;
  heroDate: Date;
  isNew: boolean;
  isHighlighted: boolean;
  onZoneChange: (index: number, zoneKey: string) => void;
  onTimeUpdate: (zoneKey: string, hours: number, minutes: number) => void;
  onRemove: (zoneKey: string) => void;
  allZones: string[];
  isDragActive: boolean;
  isCustomMode: boolean;
  use24Hour: boolean;
}

function SortableClockItem({
  id,
  zoneKey,
  index,
  baseTime,
  heroDate,
  isNew,
  isHighlighted,
  onZoneChange,
  onTimeUpdate,
  onRemove,
  allZones,
  isDragActive,
  isCustomMode,
  use24Hour,
}: SortableClockItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const city = getCityByKey(zoneKey);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className="relative"
      data-testid={`draggable-zone-${zoneKey}`}
    >
      <DigitalClock
        time={city ? getTimeInCityZone(baseTime, city.offset) : baseTime}
        cityName={city?.name || zoneKey}
        timezone={city?.gmtLabel || ""}
        isSelectable
        selectedZoneKey={zoneKey}
        onZoneChange={(newZone) => onZoneChange(index, newZone)}
        isNew={isNew}
        isHighlighted={isHighlighted}
        isDraggable
        isBeingDragged={isDragging}
        zoneKey={zoneKey}
        onTimeUpdate={onTimeUpdate}
        onRemove={() => onRemove(zoneKey)}
        isDragActive={isDragActive}
        dragHandleListeners={listeners}
        heroDate={heroDate}
        isCustomMode={isCustomMode}
        use24Hour={use24Hour}
      />
    </div>
  );
}

const MAX_CLOCKS = 16;
const STORAGE_KEY = "world-khlock-zones";

function detectLocalCity(): string {
  try {
    const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const match = ALL_CITIES.find(c => c.timezone === localTz);
    return match?.key || "london_GB";
  } catch {
    return "london_GB";
  }
}

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
    if (key.includes("_")) return key;
    return oldToNew[key] || key;
  }).filter(key => getCityByKey(key) !== undefined);
}

const DEFAULT_ZONES = ["paris_FR", "newYork_US", "losAngeles_US"];

export function TimeZoneConverter({ isCustomMode, selectedTime, onTimeUpdate, onReset, use24Hour, sortEastToWest, onSortEastToWestChange }: TimeZoneConverterProps) {
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
  const [highlightedZone, setHighlightedZone] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const preSortOrderRef = useRef<string[] | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150,
        tolerance: 8,
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

  // Sort zones east-to-west when toggled on; restore original order when toggled off
  useEffect(() => {
    if (sortEastToWest) {
      // Snapshot current manual order before sorting
      setSelectedZones((prev) => {
        preSortOrderRef.current = [...prev];
        const sorted = [...prev].sort((a, b) => {
          const cityA = getCityByKey(a);
          const cityB = getCityByKey(b);
          return (cityB?.offset ?? 0) - (cityA?.offset ?? 0);
        });
        if (sorted.every((z, i) => z === prev[i])) return prev;
        return sorted;
      });
    } else if (preSortOrderRef.current) {
      // Restore pre-sort order, accounting for zones added/removed since
      const snapshot = preSortOrderRef.current;
      setSelectedZones((current) => {
        const currentSet = new Set(current);
        const restored = snapshot.filter((z) => currentSet.has(z));
        const added = current.filter((z) => !snapshot.includes(z));
        return [...restored, ...added];
      });
      preSortOrderRef.current = null;
    }
  }, [sortEastToWest]);

  useEffect(() => {
    if (isCustomMode) return;

    setCurrentTime(new Date());

    const interval = setInterval(() => {
      // Mark as low-priority so React won't interrupt scroll gestures to run this
      startTransition(() => {
        setCurrentTime(new Date());
      });
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
  const addZoneRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!addZoneOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (addZoneRef.current && !addZoneRef.current.contains(e.target as Node)) {
        setAddZoneOpen(false);
        setAddZoneSearchQuery("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [addZoneOpen]);

  const allFilteredCities = searchCities(addZoneSearchQuery, 100);

  const canAddMoreZones = selectedZones.length < MAX_CLOCKS;

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
    // Prevent page scroll fighting the drag gesture on mobile
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    setActiveId(null);
    document.body.style.overflow = "";
    document.body.style.touchAction = "";

    if (over && active.id !== over.id) {
      // Manual reorder invalidates the sort — clear snapshot and disable toggle
      if (sortEastToWest) {
        preSortOrderRef.current = null;
        onSortEastToWestChange(false);
      }
      setSelectedZones((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }

  function handleDragCancel(_event: DragCancelEvent) {
    setActiveId(null);
    document.body.style.overflow = "";
    document.body.style.touchAction = "";
  }

  function getBaseTime(): Date {
    if (isCustomMode && selectedTime) {
      return selectedTime;
    }
    return currentTime || new Date();
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
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 sm:gap-8">
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
  const heroTime = heroCity ? getTimeInCityZone(baseTime, heroCity.offset) : baseTime;
  const activeCity = activeId ? getCityByKey(activeId) : null;

  return (
    <div className="space-y-16">
      <section>
        <DigitalClock
          time={heroTime}
          cityName={heroCity?.name || heroZone}
          timezone={heroCity?.gmtLabel || ""}
          isHero
          showSeconds={!isCustomMode}
          zoneKey={heroZone}
          onTimeUpdate={onTimeUpdate}
          isCustomMode={isCustomMode}
          onReset={onReset}
          use24Hour={use24Hour}
        />
      </section>

      <section className="border-t border-border pt-[25px] sm:pt-6">
        <div className="mb-[25px] sm:mb-8 relative" ref={addZoneRef}>
          <div className="flex items-center gap-[5px] px-[10px] pb-[20px]">
            <button
              className="flex items-center gap-1 text-sm font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors focus:outline-none disabled:opacity-50"
              disabled={!canAddMoreZones}
              onClick={() => {
                setAddZoneOpen(!addZoneOpen);
                if (addZoneOpen) setAddZoneSearchQuery("");
              }}
              data-testid="button-add-timezone"
            >
              Add Time Zone
              <ChevronsUpDown className="h-3 w-3 opacity-50" />
            </button>
          </div>
          {addZoneOpen && (
            <div className="w-full rounded-[8px] border border-[#e5e7eb] bg-white dark:bg-background shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.1),0px_2px_4px_-2px_rgba(0,0,0,0.1)] overflow-clip">
              <Command shouldFilter={false}>
                <CommandInput
                  placeholder="Search cities..."
                  value={addZoneSearchQuery}
                  onValueChange={setAddZoneSearchQuery}
                  autoFocus
                  data-testid="input-add-zone-search"
                />
                <CommandList>
                  <CommandEmpty>No cities found.</CommandEmpty>
                  <CommandGroup>
                    {allFilteredCities.map((city) => {
                      const isDisplayed = selectedZones.includes(city.key);
                      return (
                        <CommandItem
                          key={city.key}
                          value={city.key}
                          onSelect={() => {
                            if (isDisplayed) {
                              // Close menu, scroll to tile, highlight it
                              setAddZoneOpen(false);
                              setAddZoneSearchQuery("");
                              setHighlightedZone(city.key);
                              setTimeout(() => {
                                const el = document.querySelector(`[data-testid="clock-tile-${city.key}"]`);
                                el?.scrollIntoView({ behavior: "smooth", block: "center" });
                              }, 100);
                              setTimeout(() => setHighlightedZone(null), 1500);
                            } else {
                              handleAddClock(city.key);
                              setAddZoneOpen(false);
                              setAddZoneSearchQuery("");
                            }
                          }}
                          data-testid={`menu-item-${city.key}`}
                        >
                          <div className="flex flex-col">
                            <span className={isDisplayed ? "font-semibold text-foreground" : ""}>
                              {city.name}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {city.country} ({city.gmtLabel})
                            </span>
                          </div>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </div>
          )}
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
            strategy={rectSortingStrategy}
          >
            <div className="grid grid-cols-1 gap-[5px] sm:grid-cols-2 sm:gap-2.5 lg:grid-cols-3">
              {selectedZones.map((zoneKey, index) => (
                <SortableClockItem
                  key={zoneKey}
                  id={zoneKey}
                  zoneKey={zoneKey}
                  index={index}
                  baseTime={baseTime}
                  heroDate={heroTime}
                  isNew={newlyAddedZone === zoneKey}
                  isHighlighted={highlightedZone === zoneKey}
                  onZoneChange={handleZoneChange}
                  onTimeUpdate={onTimeUpdate}
                  onRemove={handleRemoveClock}
                  allZones={selectedZones}
                  isDragActive={activeId !== null}
                  isCustomMode={isCustomMode}
                  use24Hour={use24Hour}
                />
              ))}
            </div>
          </SortableContext>

          <DragOverlay>
            {activeId && activeCity ? (
              <div className="opacity-90">
                <DigitalClock
                  time={getTimeInCityZone(baseTime, activeCity.offset)}
                  cityName={activeCity.name}
                  timezone={activeCity.gmtLabel}
                  isSelectable={false}
                  isDraggable
                  isBeingDragged
                  heroDate={heroTime}
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </section>
    </div>
  );
}
