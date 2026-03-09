import { Snowflake, Sun, CloudRain, Cloud, Wind } from "lucide-react";
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

const mockForecast: DayForecast[] = [
  { day: "Lun", icon: "sun",   tempMin: 12, tempMax: 28, risk: "safe" },
  { day: "Mar", icon: "cloud", tempMin: 8,  tempMax: 22, risk: "safe" },
  { day: "Mié", icon: "frost", tempMin: 1,  tempMax: 15, risk: "warning" },
  { day: "Jue", icon: "frost", tempMin: -2, tempMax: 10, risk: "danger" },
  { day: "Vie", icon: "cloud", tempMin: 5,  tempMax: 18, risk: "warning" },
  { day: "Sáb", icon: "rain",  tempMin: 10, tempMax: 20, risk: "safe" },
  { day: "Dom", icon: "sun",   tempMin: 14, tempMax: 26, risk: "safe" },
];

interface WeeklyForecastProps {
  forecast?: DayForecast[];
}

const WeeklyForecast = ({ forecast }: WeeklyForecastProps) => {
  const days = forecast ?? mockForecast;

  return (
    <div>
      <h2 className="text-xl font-extrabold text-foreground mb-4">
        📅 Esta Semana
      </h2>
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((day, i) => {
          const Icon = iconMap[day.icon];
          return (
            <div
              key={i}
              className={`flex flex-col items-center p-2 rounded-xl border-2 ${riskBorder[day.risk]} ${riskBg[day.risk]} transition-transform hover:scale-105`}
            >
              <span className="text-xs font-bold text-foreground">{day.day}</span>
              <Icon className={`w-8 h-8 my-1.5 ${riskIconColor[day.risk]}`} />
              <span className="text-base font-extrabold text-foreground">{day.tempMax}°</span>
              <span className="text-xs text-muted-foreground">{day.tempMin}°</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WeeklyForecast;
