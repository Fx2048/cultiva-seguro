import { useState, useEffect } from "react";
import { MapContainer, TileLayer, Circle, Popup, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";

interface NDVIPoint {
  lat: number;
  lon: number;
  ndvi: number;
  label: string;
}

function getNDVIColor(ndvi: number): string {
  if (ndvi < 0.2) return "#ef4444"; // rojo - estrés severo
  if (ndvi < 0.4) return "#f97316"; // naranja - estrés moderado
  if (ndvi < 0.6) return "#eab308"; // amarillo - moderado
  return "#22c55e"; // verde - saludable
}

function getNDVILabel(ndvi: number): string {
  if (ndvi < 0.2) return "🔴 Estrés severo";
  if (ndvi < 0.4) return "🟠 Estrés moderado";
  if (ndvi < 0.6) return "🟡 Moderado";
  return "🟢 Saludable";
}

// Simulated NDVI based on region (will be replaced with Earth Engine data)
function simulateNDVI(lat: number, lon: number): number {
  // Simulate based on altitude approximation from lat
  // Higher altitude (more south in Peru) = lower NDVI
  const seed = Math.sin(lat * 12.9898 + lon * 78.233) * 43758.5453;
  const base = (seed - Math.floor(seed));
  // Adjust: highland areas have lower NDVI
  if (lat < -14) return Math.max(0.05, base * 0.4); // Puno/Arequipa
  if (lat < -12) return 0.2 + base * 0.4; // Cusco/Ayacucho
  return 0.3 + base * 0.5; // Selva/Costa
}

// Predefined monitoring points for Peru
const monitoringPoints: { lat: number; lon: number; name: string }[] = [
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

  useEffect(() => {
    // Load predefined monitoring points with simulated NDVI
    const initialPoints = monitoringPoints.map((p) => ({
      lat: p.lat,
      lon: p.lon,
      ndvi: simulateNDVI(p.lat, p.lon),
      label: p.name,
    }));
    setPoints(initialPoints);
  }, []);

  const handleMapClick = (lat: number, lon: number) => {
    const ndvi = simulateNDVI(lat, lon);
    const newPoint: NDVIPoint = {
      lat,
      lon,
      ndvi,
      label: `${lat.toFixed(2)}, ${lon.toFixed(2)}`,
    };
    setUserPoints((prev) => [...prev.slice(-9), newPoint]); // max 10 user points
  };

  const allPoints = [...points, ...userPoints];

  return (
    <div>
      <h2 className="text-xl font-extrabold text-foreground mb-3">
        🛰️ Mapa de Vegetación (NDVI)
      </h2>
      <p className="text-sm text-muted-foreground font-semibold mb-3">
        👆 Toca el mapa para ver la salud de los cultivos en cualquier punto
      </p>

      <div className="rounded-2xl overflow-hidden border-2 border-border shadow-lg" style={{ height: 380 }}>
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
                    <p className="font-bold text-sm">NDVI: {point.ndvi.toFixed(2)}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {point.ndvi < 0.3
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
          🛰️ Datos simulados · Se conectará a Earth Engine próximamente
        </p>
      </div>
    </div>
  );
};

export default NDVIMap;
