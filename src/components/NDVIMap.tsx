import { useState, useEffect, useCallback } from "react";
import { MapContainer, TileLayer, Circle, Popup, useMapEvents } from "react-leaflet";
import { Loader2, RefreshCw, Satellite, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { offlineCache } from "@/lib/offlineCache";
import "leaflet/dist/leaflet.css";

interface NDVIPoint {
  lat: number;
  lon: number;
  ndvi: number | null;
  label: string;
  source: "satellite" | "simulated" | "unavailable";
}

function getNDVIColor(ndvi: number | null): string {
  if (ndvi === null) return "#9ca3af";
  if (ndvi < 0.2) return "#ef4444";
  if (ndvi < 0.4) return "#f97316";
  if (ndvi < 0.6) return "#eab308";
  return "#22c55e";
}

function getNDVILabel(ndvi: number | null): string {
  if (ndvi === null) return "⚪ Sin datos";
  if (ndvi < 0.2) return "🔴 Estrés severo";
  if (ndvi < 0.4) return "🟠 Estrés moderado";
  if (ndvi < 0.6) return "🟡 Moderado";
  return "🟢 Saludable";
}

// Fallback simulation when Earth Engine is unavailable
function simulateNDVI(lat: number, lon: number): number {
  const seed = Math.sin(lat * 12.9898 + lon * 78.233) * 43758.5453;
  const base = seed - Math.floor(seed);
  if (lat < -14) return Math.max(0.05, base * 0.4);
  if (lat < -12) return 0.2 + base * 0.4;
  return 0.3 + base * 0.5;
}

const monitoringPoints = [
  { lat: -15.84, lon: -70.02, name: "Puno" },
  { lat: -13.53, lon: -71.97, name: "Cusco" },
  { lat: -16.41, lon: -71.54, name: "Arequipa" },
  { lat: -13.16, lon: -74.22, name: "Ayacucho" },
  { lat: -13.63, lon: -72.88, name: "Apurímac" },
  { lat: -12.79, lon: -74.97, name: "Huancavelica" },
  { lat: -12.07, lon: -75.21, name: "Junín" },
  { lat: -7.16, lon: -78.51, name: "Cajamarca" },
  { lat: -14.07, lon: -75.73, name: "Ica" },
  { lat: -17.63, lon: -71.34, name: "Tacna" },
];

function ClickHandler({ onMapClick }: { onMapClick: (lat: number, lon: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

const NDVIMap = () => {
  const [points, setPoints] = useState<NDVIPoint[]>([]);
  const [userPoints, setUserPoints] = useState<NDVIPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataSource, setDataSource] = useState<"satellite" | "simulated">("simulated");
  const [error, setError] = useState<string | null>(null);

  const fetchFromEarthEngine = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("earth-engine-ndvi", {
        body: { points: monitoringPoints },
      });

      if (fnError) throw fnError;

      if (data?.success && data.data) {
        const eePoints: NDVIPoint[] = data.data.map((p: any) => ({
          lat: p.lat,
          lon: p.lon,
          ndvi: p.ndvi,
          label: p.name,
          source: p.source === "satellite" ? "satellite" : "unavailable",
        }));

        // If all points came back null, fall back to simulation
        const hasReal = eePoints.some((p) => p.ndvi !== null);
        if (hasReal) {
          setPoints(eePoints);
          setDataSource("satellite");
        } else {
          throw new Error("No se obtuvieron datos del satélite");
        }
      } else {
        throw new Error(data?.error || "Error desconocido");
      }
    } catch (err: any) {
      console.warn("Earth Engine no disponible, usando datos simulados:", err.message);
      setError("Usando datos simulados (satélite no disponible)");
      loadSimulated();
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSimulated = () => {
    const simPoints = monitoringPoints.map((p) => ({
      lat: p.lat,
      lon: p.lon,
      ndvi: simulateNDVI(p.lat, p.lon),
      label: p.name,
      source: "simulated" as const,
    }));
    setPoints(simPoints);
    setDataSource("simulated");
  };

  useEffect(() => {
    fetchFromEarthEngine();
  }, [fetchFromEarthEngine]);

  const handleMapClick = async (lat: number, lon: number) => {
    const label = `${lat.toFixed(2)}, ${lon.toFixed(2)}`;

    // Add temporary loading point
    const tempPoint: NDVIPoint = { lat, lon, ndvi: null, label, source: "unavailable" };
    setUserPoints((prev) => [...prev.slice(-9), tempPoint]);

    // Try to get real NDVI for clicked point
    try {
      const { data } = await supabase.functions.invoke("earth-engine-ndvi", {
        body: { points: [{ lat, lon, name: label }] },
      });

      if (data?.success && data.data?.[0]?.ndvi !== null) {
        const realPoint: NDVIPoint = {
          lat, lon,
          ndvi: data.data[0].ndvi,
          label,
          source: "satellite",
        };
        setUserPoints((prev) =>
          prev.map((p) => (p.lat === lat && p.lon === lon ? realPoint : p))
        );
        return;
      }
    } catch {
      // Fall through to simulation
    }

    // Fallback to simulated
    const simPoint: NDVIPoint = {
      lat, lon,
      ndvi: simulateNDVI(lat, lon),
      label,
      source: "simulated",
    };
    setUserPoints((prev) =>
      prev.map((p) => (p.lat === lat && p.lon === lon ? simPoint : p))
    );
  };

  const allPoints = [...points, ...userPoints];

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-extrabold text-foreground">
          🛰️ Mapa de Vegetación (NDVI)
        </h2>
        <button
          onClick={fetchFromEarthEngine}
          disabled={loading}
          className="flex items-center gap-1 text-xs font-bold text-primary bg-primary/10 rounded-full px-3 py-1.5 hover:bg-primary/20 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Actualizar
        </button>
      </div>

      {/* Data source indicator */}
      <div className={`flex items-center gap-2 text-xs font-semibold mb-3 px-3 py-2 rounded-xl ${
        dataSource === "satellite"
          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
          : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
      }`}>
        {dataSource === "satellite" ? (
          <>
            <Satellite className="w-4 h-4" />
            🛰️ Datos reales de Google Earth Engine (MODIS)
          </>
        ) : (
          <>
            <AlertTriangle className="w-4 h-4" />
            ⚠️ {error || "Datos simulados · Reconectando al satélite..."}
          </>
        )}
      </div>

      <p className="text-sm text-muted-foreground font-semibold mb-3">
        👆 Toca el mapa para ver la salud de los cultivos en cualquier punto
      </p>

      <div className="rounded-2xl overflow-hidden border-2 border-border shadow-lg relative" style={{ height: 380 }}>
        {loading && (
          <div className="absolute inset-0 z-[1000] bg-background/60 flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-10 h-10 animate-spin text-primary" />
              <p className="text-sm font-bold text-foreground">Consultando satélite...</p>
            </div>
          </div>
        )}
        <MapContainer
          center={[-13.5, -72.0]}
          zoom={6}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom={true}
          attributionControl={false}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; OSM'
          />
          <ClickHandler onMapClick={handleMapClick} />

          {allPoints.map((point, i) => {
            const color = getNDVIColor(point.ndvi);
            return (
              <Circle
                key={`${point.lat}-${point.lon}-${i}`}
                center={[point.lat, point.lon]}
                radius={15000}
                pathOptions={{
                  color,
                  fillColor: color,
                  fillOpacity: 0.45,
                  weight: 2,
                }}
              >
                <Popup>
                  <div className="text-center p-1">
                    <p className="font-extrabold text-base">{point.label}</p>
                    <p className="text-2xl my-1">{getNDVILabel(point.ndvi)}</p>
                    {point.ndvi !== null && (
                      <p className="font-bold text-sm">NDVI: {point.ndvi.toFixed(2)}</p>
                    )}
                    <p className="text-xs mt-1" style={{ color: point.source === "satellite" ? "#16a34a" : "#d97706" }}>
                      {point.source === "satellite" ? "🛰️ Dato satelital" : "📊 Dato simulado"}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {point.ndvi === null
                        ? "⏳ Cargando datos..."
                        : point.ndvi < 0.3
                        ? "⚠️ Cultivos en riesgo. Riegue más."
                        : "✅ Vegetación en buen estado."}
                    </p>
                  </div>
                </Popup>
              </Circle>
            );
          })}
        </MapContainer>
      </div>

      {/* Legend */}
      <div className="mt-3 p-3 rounded-2xl bg-card border-2 border-border">
        <p className="text-sm font-extrabold text-foreground mb-2">📊 Leyenda NDVI</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { color: "#ef4444", label: "Estrés severo", range: "< 0.2", emoji: "🔴" },
            { color: "#f97316", label: "Estrés moderado", range: "0.2 - 0.4", emoji: "🟠" },
            { color: "#eab308", label: "Moderado", range: "0.4 - 0.6", emoji: "🟡" },
            { color: "#22c55e", label: "Saludable", range: "> 0.6", emoji: "🟢" },
          ].map((item) => (
            <div key={item.range} className="flex items-center gap-2">
              <div
                className="w-5 h-5 rounded-full border border-border flex-shrink-0"
                style={{ backgroundColor: item.color, opacity: 0.7 }}
              />
              <div>
                <p className="text-xs font-extrabold text-foreground">{item.emoji} {item.label}</p>
                <p className="text-xs text-muted-foreground">NDVI {item.range}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-2 font-semibold">
          {dataSource === "satellite"
            ? "🛰️ Fuente: Google Earth Engine · MODIS/061/MOD13A2"
            : "🛰️ Datos simulados · Se conectará a Earth Engine próximamente"}
        </p>
      </div>
    </div>
  );
};

export default NDVIMap;
