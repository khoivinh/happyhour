import type { Express } from "express";
import { createServer, type Server } from "http";

// City coordinates for weather lookup
const CITY_COORDS: Record<string, { lat: number; lon: number }> = {
  auckland: { lat: -36.8485, lon: 174.7633 },
  sydney: { lat: -33.8688, lon: 151.2093 },
  tokyo: { lat: 35.6762, lon: 139.6503 },
  seoul: { lat: 37.5665, lon: 126.978 },
  hongKong: { lat: 22.3193, lon: 114.1694 },
  singapore: { lat: 1.3521, lon: 103.8198 },
  bangkok: { lat: 13.7563, lon: 100.5018 },
  jakarta: { lat: -6.2088, lon: 106.8456 },
  mumbai: { lat: 19.076, lon: 72.8777 },
  dubai: { lat: 25.2048, lon: 55.2708 },
  moscow: { lat: 55.7558, lon: 37.6173 },
  cairo: { lat: 30.0444, lon: 31.2357 },
  johannesburg: { lat: -26.2041, lon: 28.0473 },
  berlin: { lat: 52.52, lon: 13.405 },
  paris: { lat: 48.8566, lon: 2.3522 },
  london: { lat: 51.5074, lon: -0.1278 },
  saoPaulo: { lat: -23.5505, lon: -46.6333 },
  newYork: { lat: 40.7128, lon: -74.006 },
  toronto: { lat: 43.6532, lon: -79.3832 },
  chicago: { lat: 41.8781, lon: -87.6298 },
  denver: { lat: 39.7392, lon: -104.9903 },
  losAngeles: { lat: 34.0522, lon: -118.2437 },
  vancouver: { lat: 49.2827, lon: -123.1207 },
};

// Simple in-memory cache for weather data (10 minute TTL)
const weatherCache = new Map<string, { data: { celsius: number; fahrenheit: number }; timestamp: number }>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Weather API endpoint
  app.get("/api/weather", async (req, res) => {
    const city = req.query.city as string;
    
    if (!city || !CITY_COORDS[city]) {
      return res.status(400).json({ error: "Invalid city" });
    }

    // Check cache first
    const cached = weatherCache.get(city);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return res.json(cached.data);
    }

    const coords = CITY_COORDS[city];

    try {
      // Using Open-Meteo API (free, no API key required)
      const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&current=temperature_2m`
      );

      if (!response.ok) {
        throw new Error("Weather API error");
      }

      const data = await response.json();
      const tempCelsius = Math.round(data.current.temperature_2m);
      const tempFahrenheit = Math.round((tempCelsius * 9) / 5 + 32);

      const weatherData = {
        celsius: tempCelsius,
        fahrenheit: tempFahrenheit,
      };

      // Cache the result
      weatherCache.set(city, { data: weatherData, timestamp: Date.now() });

      return res.json(weatherData);
    } catch (error) {
      console.error("Weather fetch error:", error);
      return res.status(500).json({ error: "Failed to fetch weather" });
    }
  });

  return httpServer;
}
