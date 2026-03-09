import { useState, useEffect } from "react";
import { ChevronRight, ChevronLeft } from "lucide-react";

const STORAGE_KEY = "agroalerta-onboarding-done";

interface Step {
  emoji: string;
  title: string;
  description: string;
  bg: string;
}

const steps: Step[] = [
  {
    emoji: "🌾",
    title: "¡Bienvenido!",
    description: "AgroAlerta te ayuda a proteger tus cultivos del frío y la sequía.",
    bg: "from-primary to-primary/80",
  },
  {
    emoji: "🔔",
    title: "Alertas",
    description: "Te avisamos cuando el clima puede dañar tus plantas.",
    bg: "from-destructive to-destructive/80",
  },
  {
    emoji: "📅",
    title: "Pronóstico",
    description: "Mira el clima de los próximos 7 días con colores fáciles.",
    bg: "from-accent to-accent/80",
  },
  {
    emoji: "🗺️",
    title: "Mapa",
    description: "Toca el mapa para ver el riesgo en cada zona del Perú.",
    bg: "from-[hsl(210,60%,55%)] to-[hsl(210,60%,45%)]",
  },
  {
    emoji: "💡",
    title: "Consejos",
    description: "Aprende a cuidar tus cultivos con tips sencillos.",
    bg: "from-primary to-primary/80",
  },
];

const OnboardingTutorial = () => {
  const [show, setShow] = useState(false);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const done = localStorage.getItem(STORAGE_KEY);
    if (!done) setShow(true);
  }, []);

  const finish = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    setShow(false);
  };

  const next = () => {
    if (current < steps.length - 1) setCurrent(current + 1);
    else finish();
  };

  const prev = () => {
    if (current > 0) setCurrent(current - 1);
  };

  if (!show) return null;

  const step = steps[current];
  const isLast = current === steps.length - 1;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-foreground/60 backdrop-blur-sm p-4">
      <div className={`w-full max-w-sm rounded-3xl bg-gradient-to-br ${step.bg} text-primary-foreground shadow-2xl overflow-hidden`}>
        {/* Skip */}
        <div className="flex justify-end p-4 pb-0">
          <button onClick={finish} className="text-sm font-bold opacity-70 hover:opacity-100 transition-opacity">
            Saltar ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-col items-center px-8 pb-2 pt-4 text-center">
          <span className="text-8xl mb-4 drop-shadow-lg animate-bounce">{step.emoji}</span>
          <h2 className="text-3xl font-extrabold mb-3">{step.title}</h2>
          <p className="text-lg font-semibold opacity-90 leading-relaxed max-w-[260px]">
            {step.description}
          </p>
        </div>

        {/* Dots */}
        <div className="flex justify-center gap-2 py-4">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-3 rounded-full transition-all duration-300 ${
                i === current ? "w-8 bg-primary-foreground" : "w-3 bg-primary-foreground/40"
              }`}
            />
          ))}
        </div>

        {/* Navigation */}
        <div className="flex gap-3 px-6 pb-6">
          {current > 0 && (
            <button
              onClick={prev}
              className="flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl bg-primary-foreground/20 font-extrabold text-lg transition-all hover:bg-primary-foreground/30"
            >
              <ChevronLeft className="w-6 h-6" />
              Atrás
            </button>
          )}
          <button
            onClick={next}
            className="flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl bg-primary-foreground text-foreground font-extrabold text-lg transition-all hover:scale-105 shadow-lg"
          >
            {isLast ? "¡Empezar!" : "Siguiente"}
            {!isLast && <ChevronRight className="w-6 h-6" />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default OnboardingTutorial;
