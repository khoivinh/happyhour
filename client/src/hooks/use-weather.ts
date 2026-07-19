import { useQuery } from "@tanstack/react-query";
import { getCityByKey } from "@/lib/city-lookup";

interface WeatherData {
  celsius: number;
  fahrenheit: number;
}

export function useWeather(zoneKey: string | undefined) {
  const city = zoneKey ? getCityByKey(zoneKey) : undefined;

  return useQuery<WeatherData>({
    queryKey: ["weather", zoneKey],
    queryFn: async () => {
      if (!city) throw new Error("City not found");
      const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lng}&current=temperature_2m`
      );
      if (!response.ok) throw new Error("Failed to fetch weather");
      const data = await response.json();
      const celsius = Math.round(data.current.temperature_2m);
      const fahrenheit = Math.round((celsius * 9) / 5 + 32);
      return { celsius, fahrenheit };
    },
    enabled: !!city,
    staleTime: 10 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
    // A shared link mounts every tile at once, firing a burst of parallel Open-Meteo calls; on a
    // flaky mobile connection one transient failure would otherwise surface "Weather Unavailable"
    // immediately (there's no loading state). Retry a few times with exponential backoff so blips
    // recover silently — the tile stays blank until retries are exhausted, never a premature error.
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
  });
}

export function getTemperatureColor(celsius: number): string {
  if (celsius <= 0) return "text-blue-500";
  if (celsius <= 10) return "text-cyan-500";
  if (celsius <= 18) return "text-green-500";
  if (celsius <= 24) return "text-yellow-500";
  if (celsius <= 30) return "text-orange-500";
  return "text-red-500";
}
