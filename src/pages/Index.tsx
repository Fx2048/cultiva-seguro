import { MapPin, Thermometer } from "lucide-react";
import AlertBanner from "@/components/AlertBanner";
import WeeklyForecast from "@/components/WeeklyForecast";
import RiskCalendar from "@/components/RiskCalendar";
import QuickTips from "@/components/QuickTips";
import PredictiveMap from "@/components/PredictiveMap";

const Index = () => {
  const today = new Date();
  const dateStr = today.toLocaleDateString("es", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <header className="bg-primary text-primary-foreground p-5 rounded-b-3xl shadow-lg">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight">
                🌾 AgroAlerta
              </h1>
              <p className="text-sm font-semibold opacity-90 capitalize">{dateStr}</p>
            </div>
            <div className="flex items-center gap-1 bg-primary-foreground/20 rounded-full px-3 py-1.5">
              <MapPin className="w-4 h-4" />
              <span className="text-sm font-bold">Mi Zona</span>
            </div>
          </div>
          {/* Current temp */}
          <div className="flex items-center justify-center mt-4 gap-3">
            <Thermometer className="w-10 h-10" />
            <span className="text-5xl font-extrabold">8°C</span>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 mt-6 space-y-6">
        {/* Main Alert */}
        <AlertBanner
          level="warning"
          type="helada"
          message="Se esperan temperaturas bajas el jueves. ¡Proteja sus cultivos!"
        />

        {/* Weekly Forecast */}
        <WeeklyForecast />

        {/* Predictive Map */}
        <PredictiveMap />

        {/* Risk Calendar */}
        <RiskCalendar />

        {/* Quick Tips */}
        <QuickTips />
      </main>
    </div>
  );
};

export default Index;
