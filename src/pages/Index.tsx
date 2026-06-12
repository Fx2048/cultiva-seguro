import { MapPin, Thermometer, Loader2, Database, Presentation, Network, Download, FileCode } from "lucide-react";
import { Link } from "react-router-dom";
import AlertBanner from "@/components/AlertBanner";
import WeeklyForecast from "@/components/WeeklyForecast";
import RiskCalendar from "@/components/RiskCalendar";
import QuickTips from "@/components/QuickTips";
import PredictiveMap from "@/components/PredictiveMap";
import NDVIMap from "@/components/NDVIMap";
import OnboardingTutorial from "@/components/OnboardingTutorial";
import ConnectivityBadge from "@/components/ConnectivityBadge";
import SmsAlertConfig from "@/components/SmsAlertConfig";
import LanguageToggle from "@/components/LanguageToggle";
import UplinkStatusPanel from "@/components/UplinkStatusPanel";
import { useWeather } from "@/hooks/useWeather";
import { useConnectivity } from "@/hooks/useConnectivity";
import { useLanguage } from "@/i18n/LanguageContext";

const Index = () => {
  const { weather, loading, error } = useWeather();
  const { isOnline, justReconnected } = useConnectivity();
  const { t } = useLanguage();

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
                🌾 {t("app.name")}
              </h1>
              <p className="text-sm font-semibold opacity-90 capitalize">{dateStr}</p>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <LanguageToggle />
              <ConnectivityBadge isOnline={isOnline} justReconnected={justReconnected} />
              <div className="flex items-center gap-1 bg-primary-foreground/20 rounded-full px-3 py-1.5">
                <MapPin className="w-4 h-4" />
                <span className="text-sm font-bold">
                  {loading ? "..." : (weather?.locationName ?? t("header.location"))}
                </span>
              </div>
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
              📍 {t("header.currentTemp")}
            </p>
          )}
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 mt-6 space-y-6">
        {/* Main Alert */}
        {error && !weather ? (
          <div className="rounded-2xl p-4 bg-muted border-2 border-border text-center">
            <p className="text-base font-bold text-muted-foreground">⚠️ {error}</p>
            <p className="text-sm text-muted-foreground mt-1">{t("forecast.error_connection")}</p>
          </div>
        ) : (
          <AlertBanner
            level={weather?.alertLevel ?? "warning"}
            type="helada"
            message={weather?.alertMessage ?? t("forecast.loading")}
          />
        )}

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

        {/* SMS Alert Config */}
        <SmsAlertConfig
          temperatura={weather?.currentTemp ?? null}
          locationName={weather?.locationName ?? "tu zona"}
          alertLevel={weather?.alertLevel ?? "safe"}
        />

        {/* Uplink status: WiFi vs 2G + cola offline */}
        <UplinkStatusPanel />

        {/* Predicciones Link */}
        <Link to="/predicciones">
          <div className="rounded-2xl border-2 border-dashed border-frost/30 p-4 flex items-center justify-center gap-3 hover:bg-frost/5 transition-colors cursor-pointer">
            <Thermometer className="w-6 h-6 text-frost" />
            <div>
              <p className="font-bold text-sm">🔮 {t("nav.predictions")}</p>
              <p className="text-xs text-muted-foreground">{t("nav.predictions_desc")}</p>
            </div>
          </div>
        </Link>

        {/* Mis Datos Link */}
        <Link to="/mis-datos">
          <div className="rounded-2xl border-2 border-dashed border-primary/30 p-4 flex items-center justify-center gap-3 hover:bg-primary/5 transition-colors cursor-pointer">
            <Database className="w-6 h-6 text-primary" />
            <div>
              <p className="font-bold text-sm">📊 {t("nav.my_data")}</p>
              <p className="text-xs text-muted-foreground">{t("nav.my_data_desc")}</p>
            </div>
          </div>
        </Link>

        {/* Presentación Link */}
        <Link to="/presentacion">
          <div className="rounded-2xl border-2 border-dashed border-accent/40 p-4 flex items-center justify-center gap-3 hover:bg-accent/5 transition-colors cursor-pointer">
            <Presentation className="w-6 h-6 text-accent" />
            <div>
              <p className="font-bold text-sm">🎤 Presentación del Proyecto</p>
              <p className="text-xs text-muted-foreground">Diapositivas WILLAY · Equipo 04</p>
            </div>
          </div>
        </Link>

        {/* Arquitectura Link */}
        <Link to="/arquitectura">
          <div className="rounded-2xl border-2 border-dashed border-frost/40 p-4 flex items-center justify-center gap-3 hover:bg-frost/5 transition-colors cursor-pointer">
            <Network className="w-6 h-6 text-frost" />
            <div>
              <p className="font-bold text-sm">🏗️ Arquitectura v4 (ESP32 + LoRa)</p>
              <p className="text-xs text-muted-foreground">Nodos distribuidos · Pi concentrador · modelo 2 capas</p>
            </div>
          </div>
        </Link>

        {/* Descargas de código */}
        <section className="rounded-2xl border-2 border-primary/30 bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Download className="w-5 h-5 text-primary" />
            <h2 className="font-extrabold text-base">💾 Códigos para descargar</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Firmware Heltec LoRa, gateway Raspberry Pi, SIM800L y entrenamiento ML.
          </p>
          <ul className="space-y-2">
            {[
              { f: "heltec_emisor.ino", d: "Emisor LoRa (ESP32 + DHT22 + YL69)" },
              { f: "heltec_receptor.ino", d: "Receptor LoRa → UART a la Pi" },
              { f: "willay_gateway_pi.py", d: "Gateway Raspberry Pi (LEDs + SMS)" },
              { f: "willay_pi_sim800_alert.py", d: "Pi + SIM800L con modelo ML" },
              { f: "willay_train_walkforward.py", d: "Entrenamiento walk-forward + capa residual" },
              { f: "willay-pi.service", d: "Servicio systemd para autoarranque" },
            ].map(({ f, d }) => (
              <li key={f}>
                <a
                  href={`/descargas/${f}`}
                  download
                  className="flex items-center gap-3 rounded-xl border border-border bg-background px-3 py-2 hover:bg-primary/5 transition-colors"
                >
                  <FileCode className="w-5 h-5 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">{f}</p>
                    <p className="text-xs text-muted-foreground truncate">{d}</p>
                  </div>
                  <Download className="w-4 h-4 text-muted-foreground shrink-0" />
                </a>
              </li>
            ))}
          </ul>
          <a
            href="/descargas/"
            className="block text-center text-xs text-primary font-semibold mt-3 underline"
          >
            Ver carpeta completa
          </a>
        </section>
      </main>
    </div>
  );
};

export default Index;
