const months = [
  { name: "Ene", risk: "safe" as const },
  { name: "Feb", risk: "safe" as const },
  { name: "Mar", risk: "safe" as const },
  { name: "Abr", risk: "warning" as const },
  { name: "May", risk: "danger" as const },
  { name: "Jun", risk: "danger" as const },
  { name: "Jul", risk: "danger" as const },
  { name: "Ago", risk: "warning" as const },
  { name: "Sep", risk: "safe" as const },
  { name: "Oct", risk: "safe" as const },
  { name: "Nov", risk: "safe" as const },
  { name: "Dic", risk: "warning" as const },
];

const riskColors = {
  safe: "bg-safe text-safe-foreground",
  warning: "bg-warning text-warning-foreground",
  danger: "bg-danger text-danger-foreground",
};

const riskLabels = {
  safe: "🟢",
  warning: "🟡",
  danger: "🔴",
};

const RiskCalendar = () => {
  const currentMonth = new Date().getMonth();

  return (
    <div>
      <h2 className="text-xl font-extrabold text-foreground mb-4">
        🗓️ Riesgo por Mes (Heladas)
      </h2>
      <div className="grid grid-cols-4 gap-2">
        {months.map((month, index) => (
          <div
            key={month.name}
            className={`rounded-xl p-3 text-center font-bold transition-transform hover:scale-105 ${
              riskColors[month.risk]
            } ${index === currentMonth ? "ring-4 ring-foreground/30 scale-105" : ""}`}
          >
            <div className="text-2xl">{riskLabels[month.risk]}</div>
            <div className="text-sm font-extrabold mt-1">{month.name}</div>
          </div>
        ))}
      </div>
      <div className="flex justify-center gap-6 mt-4 text-sm font-semibold text-muted-foreground">
        <span>🟢 Seguro</span>
        <span>🟡 Precaución</span>
        <span>🔴 Peligro</span>
      </div>
    </div>
  );
};

export default RiskCalendar;
