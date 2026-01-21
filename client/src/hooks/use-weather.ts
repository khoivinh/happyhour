import { useQuery } from "@tanstack/react-query";
import type { TimezoneKey } from "@shared/schema";

interface WeatherData {
  celsius: number;
  fahrenheit: number;
}

export function useWeather(zoneKey: TimezoneKey | undefined) {
  return useQuery<WeatherData>({
    queryKey: ["/api/weather", zoneKey],
    queryFn: async () => {
      if (!zoneKey) throw new Error("No zone key");
      const response = await fetch(`/api/weather?city=${zoneKey}`);
      if (!response.ok) throw new Error("Failed to fetch weather");
      return response.json();
    },
    enabled: !!zoneKey,
    staleTime: 10 * 60 * 1000, // 10 minutes
    refetchInterval: 10 * 60 * 1000, // Refetch every 10 minutes
    retry: 1,
  });
}

export function getTemperatureColor(celsius: number): string {
  if (celsius <= 0) return "text-blue-500"; // Freezing
  if (celsius <= 10) return "text-cyan-500"; // Cold
  if (celsius <= 18) return "text-green-500"; // Cool
  if (celsius <= 24) return "text-yellow-500"; // Mild
  if (celsius <= 30) return "text-orange-500"; // Warm
  return "text-red-500"; // Hot
}
