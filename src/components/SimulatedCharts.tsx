import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
  Legend,
  ReferenceLine,
} from "recharts";
import type { SensorReading } from "@/lib/indexedDB";
import { estadoCultivo, ESTADO_COLOR } from "@/lib/simulateReadings";
import { Badge } from "@/components/ui/badge";

interface Props {
  readings: SensorReading[];
}

const ESTADOS = ["HUMEDO", "NORMAL", "ALERTA", "ESTRES", "SEVERO"] as const;

const SimulatedCharts = ({ readings }: Props) => {
  const series = useMemo(() => {
    return [...readings]
      .sort((a, b) => a.timestamp - b.timestamp)
      .map((r) => {
        const suelo = r.humedad_suelo ?? 0;
        return {
          time: new Date(r.timestamp).toLocaleTimeString("es-PE", {
            hour: "2-digit",
            minute: "2-digit",
          }),
          temperatura: r.temperatura ?? 0,
          humedad_aire: r.humedad_aire ?? 0,
          humedad_suelo: suelo,
          estado: estadoCultivo(suelo),
        };
      });
  }, [readings]);

  const estadoCounts = useMemo(() => {
    const counts: Record<string, number> = { HUMEDO: 0, NORMAL: 0, ALERTA: 0, ESTRES: 0, SEVERO: 0 };
    series.forEach((s) => { counts[s.estado] = (counts[s.estado] || 0) + 1; });
    return ESTADOS.map((e) => ({ estado: e, cantidad: counts[e], color: ESTADO_COLOR[e] }));
  }, [series]);

  if (series.length === 0) return null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">🌡️ Temperatura y Humedad del Aire</CardTitle>
        </CardHeader>
        <CardContent className="pt-2">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={series} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="time" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="temperatura" name="Temp (°C)" stroke="#ef4444" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="humedad_aire" name="H. Aire (%)" stroke="#0ea5e9" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">🌱 Humedad del Suelo por Estado</CardTitle>
        </CardHeader>
        <CardContent className="pt-2">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={series} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="time" tick={{ fontSize: 10 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
              <Tooltip
                formatter={(v: number, _n, p: any) => [`${v}% · ${p.payload.estado}`, "Suelo"]}
              />
              <ReferenceLine y={70} stroke="#0ea5e9" strokeDasharray="3 3" label={{ value: "Húmedo", fontSize: 9, fill: "#0ea5e9" }} />
              <ReferenceLine y={40} stroke="#22c55e" strokeDasharray="3 3" label={{ value: "Normal", fontSize: 9, fill: "#22c55e" }} />
              <ReferenceLine y={25} stroke="#eab308" strokeDasharray="3 3" label={{ value: "Alerta", fontSize: 9, fill: "#eab308" }} />
              <ReferenceLine y={15} stroke="#f97316" strokeDasharray="3 3" label={{ value: "Estrés", fontSize: 9, fill: "#f97316" }} />
              <Bar dataKey="humedad_suelo" name="Suelo (%)">
                {series.map((entry, i) => (
                  <Cell key={i} fill={ESTADO_COLOR[entry.estado]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-2 mt-3">
            {estadoCounts.map((e) => (
              <Badge
                key={e.estado}
                variant="outline"
                style={{ borderColor: e.color, color: e.color }}
                className="text-xs font-bold"
              >
                {e.estado}: {e.cantidad}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">📊 Distribución de Estados</CardTitle>
        </CardHeader>
        <CardContent className="pt-2">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={estadoCounts} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="estado" tick={{ fontSize: 10 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="cantidad" name="Lecturas">
                {estadoCounts.map((e, i) => (
                  <Cell key={i} fill={e.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};

export default SimulatedCharts;