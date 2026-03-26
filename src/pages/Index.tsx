import { MapPin, Thermometer, Loader2 } from "lucide-react";
import AlertBanner from "@/components/AlertBanner";
import WeeklyForecast from "@/components/WeeklyForecast";
import RiskCalendar from "@/components/RiskCalendar";
import QuickTips from "@/components/QuickTips";
import PredictiveMap from "@/components/PredictiveMap";
import NDVIMap from "@/components/NDVIMap";
import OnboardingTutorial from "@/components/OnboardingTutorial";
import { useWeather } from "@/hooks/useWeather";

const Index = () => {
  const { weather, loading } = useWeather();

  const today = new Date();
  const dateStr = today.toLocaleDateString("es", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="min-h-screen bg-background pb-8">
      <OnboardingTutorial />

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
              <span className="text-sm font-bold">
                {loading ? "..." : (weather?.locationName ?? "Mi Zona")}
              </span>
            </div>
          </div>

          {/* Current temp */}
          <div className="flex items-center justify-center mt-4 gap-3">
            {loading ? (
              <Loader2 className="w-10 h-10 animate-spin" />
            ) : (
              <>
                <Thermometer className="w-10 h-10" />
                <span className="text-5xl font-extrabold">
                  {weather?.currentTemp ?? "--"}°C
                </span>
              </>
            )}
          </div>
          {weather && (
            <p className="text-center text-sm font-semibold opacity-80 mt-1">
              📍 Temperatura actual en tu zona
            </p>
          )}
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 mt-6 space-y-6">
        {/* Main Alert */}
        <AlertBanner
          level={weather?.alertLevel ?? "warning"}
          type="helada"
          message={weather?.alertMessage ?? "Cargando datos del clima de tu zona..."}
        />

        {/* Weekly Forecast */}
        <WeeklyForecast forecast={weather?.forecast} />

        {/* Predictive Map */}
        <PredictiveMap />

        {/* NDVI Satellite Map */}
        <NDVIMap />

        {/* Risk Calendar */}
        <RiskCalendar />

        {/* Quick Tips */}
        <QuickTips />
      </main>
    </div>
  );
};

export default Index;
