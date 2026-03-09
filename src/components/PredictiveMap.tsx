import { useState } from "react";

type RiskType = "helada" | "sequia";

const peruRegions = [
  { name: "Puno", emoji: "🌾", frostRisk: "danger", droughtRisk: "warning" },
  { name: "Cusco", emoji: "🏔️", frostRisk: "danger", droughtRisk: "safe" },
  { name: "Arequipa", emoji: "🌵", frostRisk: "warning", droughtRisk: "danger" },
  { name: "Ayacucho", emoji: "🌾", frostRisk: "warning", droughtRisk: "warning" },
  { name: "Apurímac", emoji: "🏔️", frostRisk: "danger", droughtRisk: "safe" },
  { name: "Huancavelica", emoji: "🌾", frostRisk: "danger", droughtRisk: "warning" },
  { name: "Junín", emoji: "🌿", frostRisk: "warning", droughtRisk: "safe" },
  { name: "Lima", emoji: "🏙️", frostRisk: "safe", droughtRisk: "safe" },
  { name: "Ica", emoji: "🌵", frostRisk: "safe", droughtRisk: "danger" },
  { name: "Piura", emoji: "☀️", frostRisk: "safe", droughtRisk: "danger" },
  { name: "Cajamarca", emoji: "🌱", frostRisk: "warning", droughtRisk: "safe" },
  { name: "La Libertad", emoji: "🌾", frostRisk: "safe", droughtRisk: "warning" },
  { name: "Lambayeque", emoji: "🌿", frostRisk: "safe", droughtRisk: "warning" },
  { name: "Loreto", emoji: "🌳", frostRisk: "safe", droughtRisk: "safe" },
  { name: "Madre de Dios", emoji: "🌿", frostRisk: "safe", droughtRisk: "safe" },
  { name: "Tacna", emoji: "🌵", frostRisk: "warning", droughtRisk: "danger" },
  { name: "Moquegua", emoji: "🌵", frostRisk: "warning", droughtRisk: "danger" },
  { name: "Huánuco", emoji: "🌱", frostRisk: "warning", droughtRisk: "safe" },
];

const riskConfig: Record<string, { bg: string; border: string; label: string; emoji: string }> = {
  safe:    { bg: "bg-safe/20",    border: "border-safe",    label: "Seguro",    emoji: "🟢" },
  warning: { bg: "bg-warning/20", border: "border-warning", label: "Precaución", emoji: "🟡" },
  danger:  { bg: "bg-danger/20",  border: "border-danger",  label: "Peligro",   emoji: "🔴" },
};

const PredictiveMap = () => {
  const [activeRisk, setActiveRisk] = useState<RiskType>("helada");
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div>
      <h2 className="text-xl font-extrabold text-foreground mb-3">
        🗺️ Mapa de Riesgos por Región
      </h2>

      {/* Toggle */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setActiveRisk("helada")}
          className={`flex-1 py-3 px-4 rounded-xl font-extrabold text-sm transition-all ${
            activeRisk === "helada"
              ? "bg-frost text-frost-foreground shadow-md scale-105"
              : "bg-muted text-muted-foreground"
          }`}
        >
          🧊 Heladas
        </button>
        <button
          onClick={() => setActiveRisk("sequia")}
          className={`flex-1 py-3 px-4 rounded-xl font-extrabold text-sm transition-all ${
            activeRisk === "sequia"
              ? "bg-drought text-drought-foreground shadow-md scale-105"
              : "bg-muted text-muted-foreground"
          }`}
        >
          ☀️ Sequías
        </button>
      </div>

      {/* Region grid */}
      <div className="grid grid-cols-3 gap-2">
        {peruRegions.map((region) => {
          const risk = activeRisk === "helada" ? region.frostRisk : region.droughtRisk;
          const cfg = riskConfig[risk];
          const isSelected = selected === region.name;
          return (
            <button
              key={region.name}
              onClick={() => setSelected(isSelected ? null : region.name)}
              className={`flex flex-col items-center p-3 rounded-2xl border-2 ${cfg.border} ${cfg.bg} transition-all ${
                isSelected ? "scale-105 shadow-lg ring-2 ring-foreground/20" : "hover:scale-102"
              }`}
            >
              <span className="text-2xl">{region.emoji}</span>
              <span className="text-xs font-extrabold text-foreground mt-1 leading-tight text-center">{region.name}</span>
              <span className="text-base mt-0.5">{cfg.emoji}</span>
            </button>
          );
        })}
      </div>

      {/* Detail panel */}
      {selected && (() => {
        const region = peruRegions.find(r => r.name === selected)!;
        const risk = activeRisk === "helada" ? region.frostRisk : region.droughtRisk;
        const cfg = riskConfig[risk];
        return (
          <div className={`mt-3 p-4 rounded-2xl border-2 ${cfg.border} ${cfg.bg}`}>
            <p className="font-extrabold text-lg text-foreground">
              {region.emoji} {region.name} — {cfg.emoji} {cfg.label}
            </p>
            <p className="text-sm text-muted-foreground font-semibold mt-1">
              {risk === "danger"
                ? activeRisk === "helada"
                  ? "⚠️ Alto riesgo de helada. Cubra sus plantas esta noche."
                  : "⚠️ Alto riesgo de sequía. Riegue con más frecuencia."
                : risk === "warning"
                ? activeRisk === "helada"
                  ? "🌡️ Posible helada. Esté atento al pronóstico."
                  : "💧 Poca lluvia esperada. Ahorre agua."
                : activeRisk === "helada"
                ? "✅ Sin riesgo de helada esta semana."
                : "✅ Lluvia suficiente. Sus cultivos están bien."}
            </p>
          </div>
        );
      })()}

      {/* Legend */}
      <div className="flex justify-center gap-4 mt-3">
        {Object.entries(riskConfig).map(([key, cfg]) => (
          <div key={key} className="flex items-center gap-1.5">
            <span className="text-sm">{cfg.emoji}</span>
            <span className="text-xs font-bold text-muted-foreground">{cfg.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PredictiveMap;
