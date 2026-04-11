import { useState, useEffect } from "react";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

const STORAGE_KEY = "agroalerta-onboarding-done";

const OnboardingTutorial = () => {
  const { t } = useLanguage();
  const [show, setShow] = useState(false);
  const [current, setCurrent] = useState(0);

  const steps = [
    { emoji: "🌾", title: t("onboarding.welcome"), description: t("onboarding.welcome_desc"), bg: "from-primary to-primary/80" },
    { emoji: "🔔", title: t("onboarding.alerts"), description: t("onboarding.alerts_desc"), bg: "from-destructive to-destructive/80" },
    { emoji: "📅", title: t("onboarding.forecast"), description: t("onboarding.forecast_desc"), bg: "from-accent to-accent/80" },
    { emoji: "🗺️", title: t("onboarding.map"), description: t("onboarding.map_desc"), bg: "from-[hsl(210,60%,55%)] to-[hsl(210,60%,45%)]" },
    { emoji: "💡", title: t("onboarding.tips"), description: t("onboarding.tips_desc"), bg: "from-primary to-primary/80" },
  ];

  useEffect(() => {
    const done = localStorage.getItem(STORAGE_KEY);
    if (!done) setShow(true);
  }, []);

  const finish = () => { localStorage.setItem(STORAGE_KEY, "true"); setShow(false); };
  const next = () => { if (current < steps.length - 1) setCurrent(current + 1); else finish(); };
  const prev = () => { if (current > 0) setCurrent(current - 1); };

  if (!show) return null;
  const step = steps[current];
  const isLast = current === steps.length - 1;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-foreground/60 backdrop-blur-sm p-4">
      <div className={`w-full max-w-sm rounded-3xl bg-gradient-to-br ${step.bg} text-primary-foreground shadow-2xl overflow-hidden`}>
        <div className="flex justify-end p-4 pb-0">
          <button onClick={finish} className="text-sm font-bold opacity-70 hover:opacity-100 transition-opacity">
            {t("onboarding.skip")} ✕
          </button>
        </div>
        <div className="flex flex-col items-center px-8 pb-2 pt-4 text-center">
          <span className="text-8xl mb-4 drop-shadow-lg animate-bounce">{step.emoji}</span>
          <h2 className="text-3xl font-extrabold mb-3">{step.title}</h2>
          <p className="text-lg font-semibold opacity-90 leading-relaxed max-w-[260px]">{step.description}</p>
        </div>
        <div className="flex justify-center gap-2 py-4">
          {steps.map((_, i) => (
            <div key={i} className={`h-3 rounded-full transition-all duration-300 ${i === current ? "w-8 bg-primary-foreground" : "w-3 bg-primary-foreground/40"}`} />
          ))}
        </div>
        <div className="flex gap-3 px-6 pb-6">
          {current > 0 && (
            <button onClick={prev} className="flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl bg-primary-foreground/20 font-extrabold text-lg transition-all hover:bg-primary-foreground/30">
              <ChevronLeft className="w-6 h-6" /> {t("onboarding.back")}
            </button>
          )}
          <button onClick={next} className="flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl bg-primary-foreground text-foreground font-extrabold text-lg transition-all hover:scale-105 shadow-lg">
            {isLast ? t("onboarding.start") : t("onboarding.next")}
            {!isLast && <ChevronRight className="w-6 h-6" />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default OnboardingTutorial;
