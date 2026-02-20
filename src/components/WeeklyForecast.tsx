import { Snowflake, Sun, CloudRain, Cloud, Wind } from "lucide-react";

interface DayForecast {
  day: string;
  icon: "sun" | "frost" | "rain" | "cloud" | "wind";
  tempMin: number;
  tempMax: number;
  risk: "safe" | "warning" | "danger";
}

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

const mockForecast: DayForecast[] = [
  { day: "Lun", icon: "sun", tempMin: 12, tempMax: 28, risk: "safe" },
  { day: "Mar", icon: "cloud", tempMin: 8, tempMax: 22, risk: "safe" },
  { day: "Mié", icon: "frost", tempMin: 1, tempMax: 15, risk: "warning" },
  { day: "Jue", icon: "frost", tempMin: -2, tempMax: 10, risk: "danger" },
  { day: "Vie", icon: "cloud", tempMin: 5, tempMax: 18, risk: "warning" },
  { day: "Sáb", icon: "rain", tempMin: 10, tempMax: 20, risk: "safe" },
  { day: "Dom", icon: "sun", tempMin: 14, tempMax: 26, risk: "safe" },
];

const WeeklyForecast = () => {
  return (
    <div>
      <h2 className="text-xl font-extrabold text-foreground mb-4">
        📅 Esta Semana
      </h2>
      <div className="grid grid-cols-7 gap-2">
        {mockForecast.map((day) => {
          const Icon = iconMap[day.icon];
          return (
            <div
              key={day.day}
              className={`flex flex-col items-center p-3 rounded-xl border-2 ${riskBorder[day.risk]} ${riskBg[day.risk]} transition-transform hover:scale-105`}
            >
              <span className="text-sm font-bold text-foreground">{day.day}</span>
              <Icon className="w-10 h-10 my-2 text-foreground" />
              <span className="text-lg font-extrabold text-foreground">{day.tempMax}°</span>
              <span className="text-sm text-muted-foreground">{day.tempMin}°</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WeeklyForecast;
