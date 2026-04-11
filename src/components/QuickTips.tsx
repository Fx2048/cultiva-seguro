import { Sprout, Droplets, ShieldCheck, CloudSnow } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

const QuickTips = () => {
  const { t } = useLanguage();

  const tips = [
    { icon: <CloudSnow className="w-10 h-10 text-frost" />, title: t("tips.frost.title"), description: t("tips.frost.desc") },
    { icon: <Droplets className="w-10 h-10 text-primary" />, title: t("tips.irrigation.title"), description: t("tips.irrigation.desc") },
    { icon: <Sprout className="w-10 h-10 text-safe" />, title: t("tips.harvest.title"), description: t("tips.harvest.desc") },
    { icon: <ShieldCheck className="w-10 h-10 text-warning" />, title: t("tips.preparation.title"), description: t("tips.preparation.desc") },
  ];

  return (
    <div>
      <h2 className="text-xl font-extrabold text-foreground mb-4">
        💡 {t("tips.title")}
      </h2>
      <div className="grid grid-cols-2 gap-3">
        {tips.map((tip) => (
          <div
            key={tip.title}
            className="bg-card rounded-xl p-4 shadow-sm border border-border flex flex-col items-center text-center gap-2 hover:shadow-md transition-shadow"
          >
            {tip.icon}
            <h3 className="font-bold text-foreground">{tip.title}</h3>
            <p className="text-sm text-muted-foreground">{tip.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default QuickTips;
