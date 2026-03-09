import { useState, useEffect } from "react";

export interface DayForecast {
  day: string;
  icon: "sun" | "frost" | "rain" | "cloud" | "wind";
  tempMin: number;
  tempMax: number;
  risk: "safe" | "warning" | "danger";
}

export interface WeatherData {
  currentTemp: number;
  locationName: string;
  forecast: DayForecast[];
  alertLevel: "safe" | "warning" | "danger";
  alertMessage: string;
}

// WMO weather code → icon
function wmoToIcon(code: number): DayForecast["icon"] {
  if (code === 0 || code === 1) return "sun";
  if (code === 2 || code === 3) return "cloud";
  if (code >= 51 && code <= 67) return "rain";
  if (code >= 71 && code <= 77) return "frost";
  if (code >= 80 && code <= 82) return "rain";
  if (code >= 85 && code <= 86) return "frost";
  if (code >= 95) return "wind";
  return "cloud";
}

function getRisk(tempMin: number): DayForecast["risk"] {
  if (tempMin <= 0) return "danger";
  if (tempMin <= 4) return "warning";
  return "safe";
}

const DAYS_ES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export function useWeather() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchWeather = async (lat: number, lon: number) => {
      try {
        const url =
          `https://api.open-meteo.com/v1/forecast` +
          `?latitude=${lat}&longitude=${lon}` +
          `&current=temperature_2m` +
          `&daily=temperature_2m_max,temperature_2m_min,weathercode` +
          `&timezone=auto&forecast_days=7`;

        const res = await fetch(url);
        if (!res.ok) throw new Error("Error al obtener el clima");
        const data = await res.json();

        const currentTemp = Math.round(data.current.temperature_2m);
        const { temperature_2m_max, temperature_2m_min, weathercode, time } =
          data.daily;

        const forecast: DayForecast[] = time.map((dateStr: string, i: number) => {
          const date = new Date(dateStr + "T12:00:00");
          const tempMin = Math.round(temperature_2m_min[i]);
          const tempMax = Math.round(temperature_2m_max[i]);
          return {
            day: DAYS_ES[date.getDay()],
            icon: wmoToIcon(weathercode[i]),
            tempMin,
            tempMax,
            risk: getRisk(tempMin),
          };
        });

        // Determine alert from next 3 days
        const nextDays = forecast.slice(0, 3);
        const worstRisk = nextDays.some(d => d.risk === "danger")
          ? "danger"
          : nextDays.some(d => d.risk === "warning")
          ? "warning"
          : "safe";

        const minTemp = Math.min(...nextDays.map(d => d.tempMin));
        let alertMessage = "Sin riesgo en los próximos días. ¡Sus cultivos están bien!";
        if (worstRisk === "danger")
          alertMessage = `Se esperan ${minTemp}°C. ¡Riesgo de helada! Cubra sus cultivos esta noche.`;
        else if (worstRisk === "warning")
          alertMessage = `Se esperan ${minTemp}°C. Posible helada en los próximos días.`;

        // Try to get city name via reverse geocoding (Open-Meteo nominatim)
        let locationName = "Mi Zona";
        try {
          const geoRes = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=10`,
            { headers: { "Accept-Language": "es" } }
          );
          if (geoRes.ok) {
            const geoData = await geoRes.json();
            locationName =
              geoData.address?.city ||
              geoData.address?.town ||
              geoData.address?.county ||
              geoData.address?.state ||
              "Mi Zona";
          }
        } catch {
          // silently ignore geo name error
        }

        setWeather({ currentTemp, locationName, forecast, alertLevel: worstRisk, alertMessage });
      } catch (err) {
        setError("No se pudo obtener el clima");
      } finally {
        setLoading(false);
      }
    };

    if (!navigator.geolocation) {
      setError("GPS no disponible");
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => fetchWeather(pos.coords.latitude, pos.coords.longitude),
      () => {
        // Fallback: Cusco, Peru
        fetchWeather(-13.5319, -71.9675);
      },
      { timeout: 8000 }
    );
  }, []);

  return { weather, loading, error };
}
