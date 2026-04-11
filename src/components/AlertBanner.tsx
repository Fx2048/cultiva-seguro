import { Snowflake, Sun, AlertTriangle, CheckCircle } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

type AlertLevel = "safe" | "warning" | "danger";

interface AlertBannerProps {
  level: AlertLevel;
  type: "helada" | "sequía";
  message: string;
}

const AlertBanner = ({ level, type, message }: AlertBannerProps) => {
  const { t } = useLanguage();

  const levelConfig = {
    safe: { bg: "bg-safe", text: "text-safe-foreground", icon: CheckCircle, label: t("alert.safe") },
    warning: { bg: "bg-warning", text: "text-warning-foreground", icon: AlertTriangle, label: t("alert.warning") },
    danger: { bg: "bg-danger animate-pulse-alert", text: "text-danger-foreground", icon: AlertTriangle, label: t("alert.danger") },
  };

  const typeConfig = {
    helada: { icon: Snowflake, label: t("alert.frost_label") },
    sequía: { icon: Sun, label: t("alert.drought_label") },
  };

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
          <p className="text-lg font-semibold">{typeInfo.label}</p>
          <p className="text-base font-medium opacity-90">{message}</p>
        </div>
      </div>
    </div>
  );
};

export default AlertBanner;
