import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TimeZoneConverter } from "@/components/time-zone-converter";
import { getCityByKey } from "@/lib/city-lookup";

export default function WorldClock() {
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [selectedTime, setSelectedTime] = useState<Date | null>(null);

  function handleTimeUpdate(zoneKey: string, hours: number, minutes: number) {
    const city = getCityByKey(zoneKey);
    if (!city) return;
    
    const now = new Date();
    // Create a date with the user's input hours/minutes
    const inputTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0);
    // Convert from the city's timezone to UTC
    const utcTime = new Date(inputTime.getTime() - (city.offset * 3600000) - (inputTime.getTimezoneOffset() * 60000));

    setSelectedTime(utcTime);
    setIsCustomMode(true);
  }

  function handleReset() {
    setIsCustomMode(false);
    setSelectedTime(null);
  }

  return (
    <main className="min-h-screen bg-background px-6 py-16 md:px-12 lg:px-24">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8 flex flex-col gap-6 border-b border-border pb-4 md:flex-row md:items-end md:justify-between">
          <h1 
            className="font-display font-black tracking-tight text-foreground text-5xl"
            data-testid="text-app-title"
          >
            World Khlock
          </h1>

          {isCustomMode && (
            <Button onClick={handleReset} data-testid="button-show-live-time" className="gap-2">
              <RotateCcw className="h-4 w-4" />
              Show Live Time
            </Button>
          )}
        </header>

        <TimeZoneConverter
          isCustomMode={isCustomMode}
          selectedTime={selectedTime}
          onTimeUpdate={handleTimeUpdate}
        />
      </div>
    </main>
  );
}
