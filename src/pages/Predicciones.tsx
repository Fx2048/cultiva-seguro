import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Download, Loader2, MapPin, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, BarChart, Bar, Area, ComposedChart
} from "recharts";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";

const REGIONS = [
  { name: "Puno", lat: -15.8402, lon: -70.6669 },
  { name: "Cusco", lat: -13.5319, lon: -71.9675 },
  { name: "Apurímac", lat: -13.6344, lon: -72.8897 },
  { name: "Ayacucho", lat: -13.1631, lon: -74.2236 },
  { name: "Huancavelica", lat: -12.7869, lon: -74.9731 },
  { name: "Arequipa", lat: -16.409, lon: -71.5375 },
  { name: "Junín", lat: -12.065, lon: -75.2049 },
  { name: "Tacna", lat: -17.6348, lon: -71.3379 },
];

type Prediction = {
  month: string;
  month_name: string;
  heladas: {
    probabilidad: number;
    dias_esperados: number;
    temp_minima_predicha: number | null;
    confianza: number;
    nivel_riesgo: string;
    fechas_criticas: string[];
  };
  sequia: {
    spi_index: number;
    probabilidad: number;
    precipitacion_esperada_mm: number | null;
    deficit_hidrico_mm: number;
    confianza: number;
    nivel_riesgo: string;
  };
  ndvi_predicho: number | null;
  riesgo_total: string;
  recomendaciones: string[];
};

type PredictionResult = {
  success: boolean;
  region: string;
  coordinates: { lat: number; lon: number };
  generated_at: string;
  forecast_period: string;
  predictions: Prediction[];
  historical_baseline: {
    avg_temp_min: number | null;
    avg_precipitation_mm: number | null;
    avg_ndvi: number | null;
    years_analyzed: number;
  };
  model_metrics: {
    heladas_rmse: number;
    sequia_rmse: number;
    r_squared: number;
  };
};

const riskBadge = (risk: string) => {
  const cls = risk === "ALTO" ? "bg-danger/20 text-danger border-danger"
    : risk === "MODERADO" ? "bg-warning/20 text-warning border-warning"
    : "bg-safe/20 text-safe border-safe";
  return <span className={`px-2 py-0.5 rounded-full text-xs font-extrabold border ${cls}`}>{risk}</span>;
};

const Predicciones = () => {
  const [selectedRegion, setSelectedRegion] = useState(REGIONS[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PredictionResult | null>(null);
  const [showExport, setShowExport] = useState(false);

  const fetchPredictions = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: result, error: err } = await supabase.functions.invoke("earth-engine-predictions", {
        body: { lat: selectedRegion.lat, lon: selectedRegion.lon, region_name: selectedRegion.name },
      });
      if (err) throw new Error(err.message);
      if (!result?.success) throw new Error(result?.error || "Error desconocido");
      setData(result as PredictionResult);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const chartData = data?.predictions.map(p => ({
    name: p.month_name.substring(0, 3),
    helada: p.heladas.probabilidad,
    sequia: p.sequia.probabilidad,
    ndvi: p.ndvi_predicho != null ? Math.round(p.ndvi_predicho * 100) : null,
    tempMin: p.heladas.temp_minima_predicha,
    precip: p.sequia.precipitacion_esperada_mm,
    diasHelada: p.heladas.dias_esperados,
    confianza: Math.round(p.heladas.confianza * 100),
  })) ?? [];

  const exportCSV = () => {
    if (!data) return;
    const headers = "Region,Mes,Prob_Helada(%),Dias_Helada,Temp_Min(°C),SPI,Prob_Sequia(%),Precip(mm),NDVI,Riesgo,Recomendaciones";
    const rows = data.predictions.map(p =>
      [data.region, p.month, p.heladas.probabilidad, p.heladas.dias_esperados,
        p.heladas.temp_minima_predicha ?? "", p.sequia.spi_index, p.sequia.probabilidad,
        p.sequia.precipitacion_esperada_mm ?? "", p.ndvi_predicho ?? "", p.riesgo_total,
        `"${p.recomendaciones.join("; ")}"`].join(",")
    );
    const csv = "\uFEFF" + [headers, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `willay_prediccion_${data.region}_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    setShowExport(false);
  };

  const exportJSON = () => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `willay_prediccion_${data.region}_${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    setShowExport(false);
  };

  const exportPDF = () => {
    if (!data) return;
    const tableRows = data.predictions.map(p => `<tr>
      <td>${p.month_name}</td><td>${p.heladas.probabilidad}%</td><td>${p.heladas.dias_esperados}</td>
      <td>${p.heladas.temp_minima_predicha ?? "-"}°C</td><td>${p.sequia.spi_index}</td>
      <td>${p.sequia.precipitacion_esperada_mm ?? "-"} mm</td><td>${p.ndvi_predicho ?? "-"}</td>
      <td style="color:${p.riesgo_total === "ALTO" ? "#ef4444" : p.riesgo_total === "MODERADO" ? "#f59e0b" : "#22c55e"};font-weight:bold">${p.riesgo_total}</td>
    </tr>`).join("");
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>WILLAY Predicción - ${data.region}</title>
    <style>body{font-family:Arial;margin:20px;font-size:11px}h1{color:#22c55e}
    table{width:100%;border-collapse:collapse;margin-top:12px}th,td{border:1px solid #ddd;padding:6px;text-align:center}
    th{background:#22c55e;color:white}.meta{color:#666;font-size:10px}</style></head><body>
    <h1>🌾 WILLAY - Predicción de Heladas y Sequías</h1>
    <p class="meta">Región: ${data.region} | Generado: ${new Date(data.generated_at).toLocaleDateString("es-PE")} | Período: ${data.forecast_period}</p>
    <table><thead><tr><th>Mes</th><th>Helada %</th><th>Días</th><th>Temp Mín</th><th>SPI</th><th>Precip</th><th>NDVI</th><th>Riesgo</th></tr></thead>
    <tbody>${tableRows}</tbody></table>
    <h3>Línea Base Histórica (${data.historical_baseline.years_analyzed} años)</h3>
    <p>Temp mín promedio: ${data.historical_baseline.avg_temp_min}°C | Precipitación promedio: ${data.historical_baseline.avg_precipitation_mm} mm | NDVI promedio: ${data.historical_baseline.avg_ndvi}</p>
    <p class="meta">Métricas: R² = ${data.model_metrics.r_squared} | RMSE heladas = ${data.model_metrics.heladas_rmse} | RMSE sequía = ${data.model_metrics.sequia_rmse}</p>
    </body></html>`;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, "_blank");
    if (w) w.onload = () => { w.print(); URL.revokeObjectURL(url); };
    setShowExport(false);
  };

  return (
    <div className="min-h-screen bg-background pb-8">
      <header className="bg-primary text-primary-foreground p-5 rounded-b-3xl shadow-lg">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-3">
            <Link to="/" className="p-2 rounded-xl bg-primary-foreground/20 hover:bg-primary-foreground/30">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-extrabold">🔮 Predicciones 10 Meses</h1>
              <p className="text-xs font-semibold opacity-80">Datos satelitales reales · Google Earth Engine</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 mt-6 space-y-5">
        {/* Region selector */}
        <div className="rounded-2xl border-2 border-border bg-card p-4">
          <label className="text-sm font-extrabold text-foreground mb-2 block">📍 Selecciona Región</label>
          <div className="grid grid-cols-2 gap-2">
            {REGIONS.map(r => (
              <button key={r.name} onClick={() => setSelectedRegion(r)}
                className={`py-2.5 px-3 rounded-xl text-sm font-bold transition-all ${
                  selectedRegion.name === r.name
                    ? "bg-primary text-primary-foreground shadow-md scale-105"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}>{r.name}</button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            <MapPin className="w-3 h-3 inline" /> {selectedRegion.lat}, {selectedRegion.lon}
          </p>
        </div>

        {/* Generate button */}
        <button onClick={fetchPredictions} disabled={loading}
          className="w-full py-4 rounded-2xl bg-primary text-primary-foreground font-extrabold text-base shadow-lg hover:shadow-xl transition-all disabled:opacity-60 flex items-center justify-center gap-2">
          {loading ? <><Loader2 className="w-5 h-5 animate-spin" /> Consultando Earth Engine...</> : "🛰️ Generar Predicción"}
        </button>

        {loading && (
          <div className="rounded-2xl border-2 border-border bg-card p-4 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary mb-2" />
            <p className="text-sm font-bold text-muted-foreground">Analizando 3 años de datos satelitales...</p>
            <p className="text-xs text-muted-foreground mt-1">MODIS LST + CHIRPS + NDVI (36 meses)</p>
            <p className="text-xs text-muted-foreground">Esto puede tomar 1-2 minutos</p>
          </div>
        )}

        {error && (
          <div className="rounded-2xl border-2 border-danger bg-danger/10 p-4">
            <p className="text-sm font-bold text-danger">❌ {error}</p>
            <p className="text-xs text-muted-foreground mt-1">Intente de nuevo o seleccione otra región</p>
          </div>
        )}

        {data && (
          <>
            {/* Export button */}
            <div className="flex justify-between items-center">
              <p className="text-xs text-muted-foreground font-semibold">
                📅 Generado: {new Date(data.generated_at).toLocaleDateString("es-PE")}
              </p>
              <div className="relative">
                <button onClick={() => setShowExport(!showExport)}
                  className="flex items-center gap-1 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-bold shadow">
                  <Download className="w-4 h-4" /> Exportar <ChevronDown className="w-3 h-3" />
                </button>
                {showExport && (
                  <div className="absolute right-0 top-full mt-1 bg-card border-2 border-border rounded-xl shadow-lg z-10 overflow-hidden">
                    <button onClick={exportCSV} className="block w-full px-4 py-2.5 text-sm font-bold text-foreground hover:bg-muted text-left">📊 CSV (Excel)</button>
                    <button onClick={exportJSON} className="block w-full px-4 py-2.5 text-sm font-bold text-foreground hover:bg-muted text-left">🔧 JSON</button>
                    <button onClick={exportPDF} className="block w-full px-4 py-2.5 text-sm font-bold text-foreground hover:bg-muted text-left">📄 PDF Informe</button>
                  </div>
                )}
              </div>
            </div>

            {/* Timeline chart */}
            <div className="rounded-2xl border-2 border-border bg-card p-4">
              <h3 className="text-base font-extrabold text-foreground mb-3">📈 Línea de Tiempo - Riesgos</h3>
              <ResponsiveContainer width="100%" height={250}>
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 700 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 10 }} label={{ value: "%", position: "insideLeft", fontSize: 10 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12, fontWeight: 600 }} />
                  <Legend wrapperStyle={{ fontSize: 11, fontWeight: 700 }} />
                  <Area yAxisId="left" type="monotone" dataKey="confianza" fill="hsl(var(--muted))" stroke="none" name="Confianza %" opacity={0.3} />
                  <Line yAxisId="left" type="monotone" dataKey="helada" stroke="hsl(var(--danger))" strokeWidth={2.5} name="Helada %" dot={{ r: 3 }} />
                  <Line yAxisId="left" type="monotone" dataKey="sequia" stroke="hsl(var(--drought))" strokeWidth={2.5} name="Sequía %" dot={{ r: 3 }} />
                  <Line yAxisId="right" type="monotone" dataKey="ndvi" stroke="hsl(var(--safe))" strokeWidth={2} name="NDVI×100" dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Bar chart: frost days + precipitation */}
            <div className="rounded-2xl border-2 border-border bg-card p-4">
              <h3 className="text-base font-extrabold text-foreground mb-3">📊 Días de Helada y Precipitación</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 700 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12, fontWeight: 600 }} />
                  <Legend wrapperStyle={{ fontSize: 11, fontWeight: 700 }} />
                  <Bar dataKey="diasHelada" fill="hsl(var(--frost))" name="Días Helada" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="precip" fill="hsl(var(--primary))" name="Precip (mm)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Data table */}
            <div className="rounded-2xl border-2 border-border bg-card overflow-hidden">
              <h3 className="text-base font-extrabold text-foreground p-4 pb-2">📋 Tabla Detallada</h3>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs font-extrabold">Mes</TableHead>
                      <TableHead className="text-xs font-extrabold">Helada</TableHead>
                      <TableHead className="text-xs font-extrabold">Días</TableHead>
                      <TableHead className="text-xs font-extrabold">T.Mín</TableHead>
                      <TableHead className="text-xs font-extrabold">SPI</TableHead>
                      <TableHead className="text-xs font-extrabold">Precip</TableHead>
                      <TableHead className="text-xs font-extrabold">Riesgo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.predictions.map(p => (
                      <TableRow key={p.month}>
                        <TableCell className="text-xs font-bold">{p.month_name.substring(0, 3)}</TableCell>
                        <TableCell className="text-xs font-bold">{p.heladas.probabilidad}%</TableCell>
                        <TableCell className="text-xs font-bold">{p.heladas.dias_esperados}</TableCell>
                        <TableCell className="text-xs font-bold">{p.heladas.temp_minima_predicha ?? "-"}°</TableCell>
                        <TableCell className="text-xs font-bold">{p.sequia.spi_index}</TableCell>
                        <TableCell className="text-xs font-bold">{p.sequia.precipitacion_esperada_mm ?? "-"}</TableCell>
                        <TableCell>{riskBadge(p.riesgo_total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Recommendations per month */}
            <div className="rounded-2xl border-2 border-border bg-card p-4">
              <h3 className="text-base font-extrabold text-foreground mb-3">💡 Recomendaciones</h3>
              <div className="space-y-3">
                {data.predictions.filter(p => p.riesgo_total !== "BAJO").slice(0, 5).map(p => (
                  <div key={p.month} className={`p-3 rounded-xl border-2 ${
                    p.riesgo_total === "ALTO" ? "border-danger bg-danger/5" : "border-warning bg-warning/5"
                  }`}>
                    <p className="text-sm font-extrabold text-foreground">{p.month_name} {riskBadge(p.riesgo_total)}</p>
                    <ul className="mt-1 space-y-0.5">
                      {p.recomendaciones.map((r, i) => (
                        <li key={i} className="text-xs font-semibold text-muted-foreground">{r}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            {/* Historical baseline */}
            <div className="rounded-2xl border-2 border-border bg-card p-4">
              <h3 className="text-sm font-extrabold text-foreground mb-2">📐 Línea Base Histórica ({data.historical_baseline.years_analyzed} años)</h3>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-2 rounded-xl bg-frost/10">
                  <p className="text-lg font-extrabold text-frost">{data.historical_baseline.avg_temp_min ?? "-"}°</p>
                  <p className="text-[10px] font-bold text-muted-foreground">Temp Mín Prom</p>
                </div>
                <div className="p-2 rounded-xl bg-primary/10">
                  <p className="text-lg font-extrabold text-primary">{data.historical_baseline.avg_precipitation_mm ?? "-"}</p>
                  <p className="text-[10px] font-bold text-muted-foreground">Precip mm</p>
                </div>
                <div className="p-2 rounded-xl bg-safe/10">
                  <p className="text-lg font-extrabold text-safe">{data.historical_baseline.avg_ndvi ?? "-"}</p>
                  <p className="text-[10px] font-bold text-muted-foreground">NDVI Prom</p>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground mt-2 text-center">
                R² = {data.model_metrics.r_squared} | RMSE heladas = {data.model_metrics.heladas_rmse}°C | RMSE sequía = {data.model_metrics.sequia_rmse}
              </p>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default Predicciones;
