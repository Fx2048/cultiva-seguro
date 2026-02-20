import { Sprout, Droplets, ShieldCheck, CloudSnow } from "lucide-react";

interface Tip {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const tips: Tip[] = [
  {
    icon: <CloudSnow className="w-10 h-10 text-frost" />,
    title: "Helada",
    description: "Cubra sus plantas con plástico o paja antes de la noche fría.",
  },
  {
    icon: <Droplets className="w-10 h-10 text-primary" />,
    title: "Riego",
    description: "Riegue temprano en la mañana para proteger las raíces del frío.",
  },
  {
    icon: <Sprout className="w-10 h-10 text-safe" />,
    title: "Cosecha",
    description: "Si hay riesgo, coseche lo que pueda antes de la helada.",
  },
  {
    icon: <ShieldCheck className="w-10 h-10 text-warning" />,
    title: "Preparación",
    description: "Tenga listas lonas y materiales para cubrir sus cultivos.",
  },
];

const QuickTips = () => {
  return (
    <div>
      <h2 className="text-xl font-extrabold text-foreground mb-4">
        💡 Consejos Rápidos
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
