import { willayDB, type SensorReading } from "@/lib/indexedDB";

export function estadoCultivo(suelo: number): "HUMEDO" | "NORMAL" | "ALERTA" | "ESTRES" | "SEVERO" {
  if (suelo > 70) return "HUMEDO";
  if (suelo >= 40) return "NORMAL";
  if (suelo >= 25) return "ALERTA";
  if (suelo >= 15) return "ESTRES";
  return "SEVERO";
}

export const ESTADO_COLOR: Record<string, string> = {
  HUMEDO: "#0ea5e9",
  NORMAL: "#22c55e",
  ALERTA: "#eab308",
  ESTRES: "#f97316",
  SEVERO: "#ef4444",
};

// Base target requested by user + a spread that hits every estado for charts.
const SOIL_SEQUENCE = [99, 92, 85, 78, 72, 65, 55, 48, 42, 38, 32, 28, 24, 20, 17, 14, 10, 6, 3, 18, 27, 45, 60, 80, 99];

export async function simulateReadings(): Promise<number> {
  const now = Date.now();
  const items: SensorReading[] = SOIL_SEQUENCE.map((suelo, i) => {
    // Temperature: hover around 23.1°C with small variation
    const temperatura = +(23.1 + (Math.random() - 0.5) * 1.4).toFixed(1);
    // Air humidity: user asked for 1% — keep very low with tiny jitter
    const humedad_aire = Math.max(1, Math.min(6, Math.round(1 + Math.random() * 3)));
    const estado = estadoCultivo(suelo);
    const alerta = estado === "SEVERO" ? "sequía" : estado === "ESTRES" ? "sequía" : null;
    return {
      id: `sim-${now}-${i}`,
      device_id: "EMI-001",
      timestamp: now - (SOIL_SEQUENCE.length - i) * 5 * 60 * 1000, // 5-min spacing
      temperatura,
      humedad_aire,
      humedad_suelo: suelo,
      alerta,
      lat: -13.5183,
      lon: -71.9781,
      sincronizado: false,
    };
  });
  await willayDB.addManySensorReadings(items);
  return items.length;
}