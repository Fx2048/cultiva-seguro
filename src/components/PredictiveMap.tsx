import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

type RiskType = "helada" | "sequia";

// Peru departments with approximate centroids and polygon bounds
const peruRegions = [
  {
    name: "Puno",
    coords: [-15.0, -70.0],
    bounds: [[-17.0, -72.0], [-13.0, -68.0]] as [[number, number], [number, number]],
    frostRisk: "danger",
    droughtRisk: "warning",
    emoji: "🌾",
  },
  {
    name: "Cusco",
    coords: [-13.5, -72.0],
    bounds: [[-15.0, -73.5], [-11.5, -70.0]] as [[number, number], [number, number]],
    frostRisk: "danger",
    droughtRisk: "safe",
    emoji: "🏔️",
  },
  {
    name: "Arequipa",
    coords: [-16.4, -71.5],
    bounds: [[-17.5, -73.5], [-14.5, -70.0]] as [[number, number], [number, number]],
    frostRisk: "warning",
    droughtRisk: "danger",
    emoji: "🌵",
  },
  {
    name: "Ayacucho",
    coords: [-13.2, -74.2],
    bounds: [[-15.0, -75.5], [-12.0, -73.0]] as [[number, number], [number, number]],
    frostRisk: "warning",
    droughtRisk: "warning",
    emoji: "🌾",
  },
  {
    name: "Apurímac",
    coords: [-14.0, -73.0],
    bounds: [[-15.0, -74.0], [-13.0, -72.0]] as [[number, number], [number, number]],
    frostRisk: "danger",
    droughtRisk: "safe",
    emoji: "🏔️",
  },
  {
    name: "Huancavelica",
    coords: [-12.8, -75.0],
    bounds: [[-13.8, -75.8], [-11.8, -74.0]] as [[number, number], [number, number]],
    frostRisk: "danger",
    droughtRisk: "warning",
    emoji: "🌾",
  },
  {
    name: "Junín",
    coords: [-11.5, -75.3],
    bounds: [[-12.8, -76.3], [-10.0, -74.0]] as [[number, number], [number, number]],
    frostRisk: "warning",
    droughtRisk: "safe",
    emoji: "🌿",
  },
  {
    name: "Lima",
    coords: [-11.5, -76.5],
    bounds: [[-13.5, -77.5], [-9.5, -75.5]] as [[number, number], [number, number]],
    frostRisk: "safe",
    droughtRisk: "safe",
    emoji: "🏙️",
  },
  {
    name: "Ica",
    coords: [-14.5, -75.5],
    bounds: [[-15.5, -76.5], [-13.0, -74.5]] as [[number, number], [number, number]],
    frostRisk: "safe",
    droughtRisk: "danger",
    emoji: "🌵",
  },
  {
    name: "Piura",
    coords: [-5.2, -80.6],
    bounds: [[-6.5, -81.5], [-3.5, -79.0]] as [[number, number], [number, number]],
    frostRisk: "safe",
    droughtRisk: "danger",
    emoji: "☀️",
  },
  {
    name: "Cajamarca",
    coords: [-7.0, -78.5],
    bounds: [[-9.0, -79.5], [-5.0, -77.5]] as [[number, number], [number, number]],
    frostRisk: "warning",
    droughtRisk: "safe",
    emoji: "🌱",
  },
  {
    name: "La Libertad",
    coords: [-8.0, -78.5],
    bounds: [[-9.5, -79.5], [-6.5, -77.0]] as [[number, number], [number, number]],
    frostRisk: "safe",
    droughtRisk: "warning",
    emoji: "🌾",
  },
  {
    name: "Lambayeque",
    coords: [-6.5, -80.0],
    bounds: [[-7.5, -80.8], [-5.5, -79.0]] as [[number, number], [number, number]],
    frostRisk: "safe",
    droughtRisk: "warning",
    emoji: "🌿",
  },
  {
    name: "Loreto",
    coords: [-4.0, -75.0],
    bounds: [[-7.0, -77.0], [-1.0, -73.0]] as [[number, number], [number, number]],
    frostRisk: "safe",
    droughtRisk: "safe",
    emoji: "🌳",
  },
  {
    name: "Madre de Dios",
    coords: [-11.5, -70.5],
    bounds: [[-13.5, -72.5], [-9.5, -68.5]] as [[number, number], [number, number]],
    frostRisk: "safe",
    droughtRisk: "safe",
    emoji: "🌿",
  },
  {
    name: "Tacna",
    coords: [-17.5, -70.3],
    bounds: [[-18.3, -71.0], [-16.5, -69.5]] as [[number, number], [number, number]],
    frostRisk: "warning",
    droughtRisk: "danger",
    emoji: "🌵",
  },
  {
    name: "Moquegua",
    coords: [-16.8, -70.9],
    bounds: [[-17.5, -71.5], [-15.5, -70.0]] as [[number, number], [number, number]],
    frostRisk: "warning",
    droughtRisk: "danger",
    emoji: "🌵",
  },
  {
    name: "Huánuco",
    coords: [-9.5, -76.5],
    bounds: [[-11.0, -77.5], [-7.5, -75.0]] as [[number, number], [number, number]],
    frostRisk: "warning",
    droughtRisk: "safe",
    emoji: "🌱",
  },
];

const riskColor: Record<string, string> = {
  safe: "#22c55e",
  warning: "#f59e0b",
  danger: "#ef4444",
};

const riskLabel: Record<string, string> = {
  safe: "Seguro",
  warning: "Precaución",
  danger: "Peligro",
};

const riskEmoji: Record<string, string> = {
  safe: "🟢",
  warning: "🟡",
  danger: "🔴",
};

const PredictiveMap = () => {
  const mapRef = useRef<L.Map | null>(null);
  const containerId = "predictive-map";
  const [activeRisk, setActiveRisk] = useState<RiskType>("helada");
  const rectanglesRef = useRef<L.Rectangle[]>([]);

  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const map = L.map(containerId, {
      center: [-9.5, -75.0],
      zoom: 5,
      zoomControl: true,
      scrollWheelZoom: false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      opacity: 0.6,
    }).addTo(map);

    mapRef.current = map;

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;

    // Remove old rectangles
    rectanglesRef.current.forEach((r) => r.remove());
    rectanglesRef.current = [];

    peruRegions.forEach((region) => {
      const risk = activeRisk === "helada" ? region.frostRisk : region.droughtRisk;
      const color = riskColor[risk];

      const rect = L.rectangle(region.bounds, {
        color: color,
        fillColor: color,
        fillOpacity: 0.45,
        weight: 2,
        opacity: 0.8,
      }).addTo(mapRef.current!);

      const popupContent = `
        <div style="font-family: 'Nunito', sans-serif; padding: 4px; min-width: 140px;">
          <div style="font-size: 18px; font-weight: 800; color: #1a1a1a; margin-bottom: 4px;">
            ${region.emoji} ${region.name}
          </div>
          <div style="font-size: 14px; font-weight: 700; color: ${color}; background: ${color}22; border-radius: 8px; padding: 4px 8px; display: inline-block;">
            ${riskEmoji[risk]} ${activeRisk === "helada" ? "Helada" : "Sequía"}: ${riskLabel[risk]}
          </div>
        </div>
      `;

      rect.bindPopup(popupContent, { maxWidth: 200 });
      rect.on("mouseover", () => rect.openPopup());
      rect.on("mouseout", () => rect.closePopup());

      rectanglesRef.current.push(rect);
    });
  }, [activeRisk]);

  return (
    <div>
      <h2 className="text-xl font-extrabold text-foreground mb-3">
        🗺️ Mapa Predictivo de Riesgos
      </h2>

      {/* Toggle buttons */}
      <div className="flex gap-2 mb-3">
        <button
          onClick={() => setActiveRisk("helada")}
          className={`flex-1 py-2.5 px-4 rounded-xl font-extrabold text-sm transition-all ${
            activeRisk === "helada"
              ? "bg-frost text-frost-foreground shadow-md scale-105"
              : "bg-muted text-muted-foreground"
          }`}
        >
          🧊 Heladas
        </button>
        <button
          onClick={() => setActiveRisk("sequia")}
          className={`flex-1 py-2.5 px-4 rounded-xl font-extrabold text-sm transition-all ${
            activeRisk === "sequia"
              ? "bg-drought text-drought-foreground shadow-md scale-105"
              : "bg-muted text-muted-foreground"
          }`}
        >
          ☀️ Sequías
        </button>
      </div>

      {/* Map container */}
      <div className="rounded-2xl overflow-hidden border-2 border-border shadow-md" style={{ height: "380px" }}>
        <div id={containerId} style={{ height: "100%", width: "100%" }} />
      </div>

      {/* Legend */}
      <div className="flex justify-center gap-4 mt-3">
        {Object.entries(riskLabel).map(([key, label]) => (
          <div key={key} className="flex items-center gap-1.5">
            <div
              className="w-4 h-4 rounded-full border border-border/50"
              style={{ backgroundColor: riskColor[key] }}
            />
            <span className="text-xs font-bold text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>

      <p className="text-center text-xs text-muted-foreground mt-2 font-semibold">
        Toca una región para ver el detalle
      </p>
    </div>
  );
};

export default PredictiveMap;
