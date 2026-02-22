import { useState, useEffect } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TimeZoneConverter } from "@/components/time-zone-converter";
import { getCityByKey } from "@/lib/city-lookup";

export default function WorldClock() {
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [selectedTime, setSelectedTime] = useState<Date | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);

  // Detect scroll to minimize header
  useEffect(() => {
    function handleScroll() {
      setIsScrolled(window.scrollY > 80);
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

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
    <main className="min-h-screen bg-background">
      {/* Sticky header that minimizes on scroll */}
      <header
        className={`sticky top-0 z-50 bg-background border-b border-border px-6 md:px-12 lg:px-24 transition-[padding] duration-500 ease-in-out ${
          isScrolled ? "py-3" : "py-8"
        }`}
      >
        <div className="mx-auto max-w-4xl flex flex-row items-center justify-between gap-4">
          <h1
            className={`font-display font-black tracking-tight text-foreground transition-[font-size] duration-500 ease-in-out ${
              isScrolled ? "text-3xl" : "text-5xl"
            }`}
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
        </div>
      </header>

      <div className="px-6 py-8 md:px-12 lg:px-24">
        <div className="mx-auto max-w-4xl">
          <TimeZoneConverter
            isCustomMode={isCustomMode}
            selectedTime={selectedTime}
            onTimeUpdate={handleTimeUpdate}
          />
        </div>
      </div>
    </main>
  );
}
