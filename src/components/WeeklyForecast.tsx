import { Snowflake, Sun, CloudRain, Cloud, Wind, AlertTriangle, Loader2 } from "lucide-react";
import { DayForecast } from "@/hooks/useWeather";

const iconMap = {
  sun: Sun,
  frost: Snowflake,
  rain: CloudRain,
  cloud: Cloud,
  wind: Wind,
};

const riskBorder = {
  safe: "border-safe",
  warning: "border-warning",
  danger: "border-danger",
};

const riskBg = {
  safe: "bg-safe/10",
  warning: "bg-warning/10",
  danger: "bg-danger/10",
};

const riskIconColor = {
  safe: "text-safe",
  warning: "text-warning",
  danger: "text-danger",
};

interface WeeklyForecastProps {
  forecast?: DayForecast[];
}

const WeeklyForecast = ({ forecast }: WeeklyForecastProps) => {
  // No forecast yet = loading or unavailable
  if (!forecast) {
    return (
      <div>
        <h2 className="text-xl font-extrabold text-foreground mb-4">
          📅 Esta Semana
        </h2>
        <div className="flex items-center justify-center gap-3 p-6 rounded-2xl bg-card border-2 border-border">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          <p className="text-sm font-semibold text-muted-foreground">
            Obteniendo pronóstico de tu zona...
          </p>
        </div>
      </div>
    );
  }

  // Detect frost risk in the next 48h (first 2 days)
  const next48h = forecast.slice(0, 2);
  const hasFrostDanger = next48h.some((d) => d.tempMin <= 0);
  const hasFrostWarning = next48h.some((d) => d.tempMin > 0 && d.tempMin <= 2);
  const lowestTemp = Math.min(...forecast.map((d) => d.tempMin));
  const frostDays = forecast.filter((d) => d.tempMin <= 2);

  // Compute trend: descending temperature?
  const descendingTrend =
    forecast.length >= 3 &&
    forecast[2].tempMin < forecast[1].tempMin &&
    forecast[1].tempMin < forecast[0].tempMin;

  return (
    <div>
      <h2 className="text-xl font-extrabold text-foreground mb-3">
        📅 Pronóstico Semanal
      </h2>

      {/* Frost Alert Banner */}
      {hasFrostDanger && (
        <div className="flex items-center gap-3 p-3 mb-3 rounded-2xl bg-danger/15 border-2 border-danger animate-pulse">
          <AlertTriangle className="w-8 h-8 text-danger flex-shrink-0" />
          <div>
            <p className="text-sm font-extrabold text-danger">
              🔴 ¡HELADA INMINENTE EN 48H!
            </p>
            <p className="text-xs font-semibold text-danger/80">
              Se esperan {lowestTemp}°C · ¡Cubra sus cultivos AHORA!
            </p>
          </div>
        </div>
      )}

      {!hasFrostDanger && hasFrostWarning && (
        <div className="flex items-center gap-3 p-3 mb-3 rounded-2xl bg-warning/15 border-2 border-warning">
          <AlertTriangle className="w-7 h-7 text-warning flex-shrink-0" />
          <div>
            <p className="text-sm font-extrabold text-warning">
              🟡 Posible helada en las próximas 48 horas
            </p>
            <p className="text-xs font-semibold text-warning/80">
              Se esperan {lowestTemp}°C · Prepare protección para sus cultivos
            </p>
          </div>
        </div>
      )}

      {descendingTrend && !hasFrostDanger && !hasFrostWarning && (
        <div className="flex items-center gap-2 p-2 mb-3 rounded-xl bg-muted border border-border">
          <span className="text-lg">📉</span>
          <p className="text-xs font-semibold text-muted-foreground">
            Tendencia descendente · Las temperaturas están bajando
          </p>
        </div>
      )}

      {/* Forecast cards */}
      <div className="grid grid-cols-7 gap-1.5">
        {forecast.map((day, i) => {
          const Icon = iconMap[day.icon];
          const isFrostRisk = day.tempMin <= 2;
          return (
            <div
              key={i}
              className={`flex flex-col items-center p-2 rounded-xl border-2 ${riskBorder[day.risk]} ${riskBg[day.risk]} transition-transform hover:scale-105 relative`}
            >
              {isFrostRisk && (
                <span className="absolute -top-1.5 -right-1.5 text-sm">❄️</span>
              )}
              <span className="text-xs font-bold text-foreground">{day.day}</span>
              <Icon className={`w-8 h-8 my-1.5 ${riskIconColor[day.risk]}`} />
              <span className="text-base font-extrabold text-foreground">{day.tempMax}°</span>
              <span className={`text-xs font-bold ${isFrostRisk ? "text-danger" : "text-muted-foreground"}`}>
                {day.tempMin}°
              </span>
              {day.risk === "danger" && (
                <span className="text-[10px] font-extrabold text-danger mt-0.5">¡HELADA!</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="mt-3 p-2.5 rounded-xl bg-card border border-border">
        {frostDays.length > 0 ? (
          <p className="text-xs font-semibold text-foreground">
            ⚠️ <span className="font-extrabold">{frostDays.length} día{frostDays.length > 1 ? "s" : ""}</span> con riesgo de helada esta semana
            {descendingTrend && " · 📉 Tendencia descendente"}
          </p>
        ) : (
          <p className="text-xs font-semibold text-safe">
            ✅ Sin riesgo de helada esta semana · Cultivos seguros
          </p>
        )}
        <p className="text-[10px] text-muted-foreground mt-1">
          🌐 Datos: Open-Meteo · Actualizado con tu GPS
        </p>
      </div>
    </div>
  );
};

export default WeeklyForecast;
