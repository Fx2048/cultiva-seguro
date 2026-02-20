import { Snowflake, Sun, Droplets, ThermometerSun, AlertTriangle, CheckCircle } from "lucide-react";

type AlertLevel = "safe" | "warning" | "danger";

interface AlertBannerProps {
  level: AlertLevel;
  type: "helada" | "sequía";
  message: string;
}

const levelConfig = {
  safe: {
    bg: "bg-safe",
    text: "text-safe-foreground",
    icon: CheckCircle,
    label: "SIN RIESGO",
  },
  warning: {
    bg: "bg-warning",
    text: "text-warning-foreground",
    icon: AlertTriangle,
    label: "¡PRECAUCIÓN!",
  },
  danger: {
    bg: "bg-danger animate-pulse-alert",
    text: "text-danger-foreground",
    icon: AlertTriangle,
    label: "¡PELIGRO!",
  },
};

const typeConfig = {
  helada: { icon: Snowflake, color: "text-frost" },
  sequía: { icon: Sun, color: "text-drought" },
};

const AlertBanner = ({ level, type, message }: AlertBannerProps) => {
  const config = levelConfig[level];
  const typeInfo = typeConfig[type];
  const StatusIcon = config.icon;
  const TypeIcon = typeInfo.icon;

  return (
    <div className={`${config.bg} ${config.text} rounded-2xl p-6 shadow-lg`}>
      <div className="flex items-center gap-4">
        <div className="flex-shrink-0">
          <TypeIcon className="w-16 h-16" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <StatusIcon className="w-6 h-6" />
            <span className="text-xl font-extrabold">{config.label}</span>
          </div>
          <p className="text-lg font-semibold">{type === "helada" ? "HELADA" : "SEQUÍA"}</p>
          <p className="text-base font-medium opacity-90">{message}</p>
        </div>
      </div>
    </div>
  );
};

export default AlertBanner;
