import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Download, Loader2, MapPin, ChevronDown, Info, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import LanguageToggle from "@/components/LanguageToggle";
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

const CROPS = [
  { id: "generico", label: "🌾 Genérico", desc: "Umbral: 0°C" },
  { id: "papa", label: "🥔 Papa", desc: "Umbral: -1°C (floración)" },
  { id: "maiz", label: "🌽 Maíz", desc: "Umbral: 0°C (floración)" },
  { id: "quinua", label: "🌾 Quinua", desc: "Umbral: -2°C (floración)" },
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
    nivel_confianza?: string;
    fechas_criticas: string[];
    factores?: string[];
    umbral_cultivo?: number;
    etapa_cultivo?: string;
  };
  sequia: {
    spi_index: number;
    probabilidad: number;
    precipitacion_esperada_mm: number | null;
    deficit_hidrico_mm: number;
    confianza: number;
    nivel_riesgo: string;
    nivel_confianza?: string;
    factores?: string[];
  };
  ndvi_predicho: number | null;
  riesgo_total: string;
  recomendaciones: string[];
};

type PredictionResult = {
  success: boolean;
  region: string;
  fallback?: boolean;
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
  model_info?: {
    version?: string;
    heladas?: string;
    sequia?: string;
    factores?: string[];
    umbrales_cultivo?: any;
    data_sources?: string[];
  };
  model_metrics: {
    heladas_precision?: number | null;
    heladas_recall?: number | null;
    sequia_precision?: number | null;
    sequia_recall?: number | null;
    heladas_rmse?: number;
    sequia_rmse?: number;
    r_squared?: number | null;
    f1_helada?: number | null;
    f1_sequia?: number | null;
    modelo?: string | null;
    fuente?: string;
    nota?: string;
  };
  crop_config?: {
    crop_type: string;
    thresholds: any;
  };
};

const riskBadge = (risk: string) => {
  const cls = risk === "ALTO" ? "bg-danger/20 text-danger border-danger"
    : risk === "MODERADO" ? "bg-warning/20 text-warning border-warning"
    : "bg-safe/20 text-safe border-safe";
  return <span className={`px-2 py-0.5 rounded-full text-xs font-extrabold border ${cls}`}>{risk}</span>;
};

const confidenceBadge = (level?: string, t?: (k: any) => string) => {
  if (!level) return null;
  const cls = level === "alto" ? "bg-safe/15 text-safe border-safe"
    : level === "medio" ? "bg-warning/15 text-warning border-warning"
    : "bg-danger/15 text-danger border-danger";
  const label = t ? (level === "alto" ? t("confidence.high") : level === "medio" ? t("confidence.medium") : t("confidence.low")) : level;
  return <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold border ${cls}`}>{label}</span>;
};

const Predicciones = () => {
  const { t } = useLanguage();
  const [selectedRegion, setSelectedRegion] = useState(REGIONS[0]);
  const [selectedCrop, setSelectedCrop] = useState(CROPS[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PredictionResult | null>(null);
  const [showExport, setShowExport] = useState(false);
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);

  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [isFallback, setIsFallback] = useState(false);

  const fetchPredictions = async () => {
    setLoading(true);
    setError(null);
    setStatusMsg(`⏳ ${t("pred.loading_satellite")}`);
    setIsFallback(false);
    console.log('🔮 Solicitando predicción para:', { region: selectedRegion.name, lat: selectedRegion.lat, lon: selectedRegion.lon, crop: selectedCrop.id });
    try {
      const { data: result, error: err } = await supabase.functions.invoke("earth-engine-predictions", {
        body: { lat: selectedRegion.lat, lon: selectedRegion.lon, region_name: selectedRegion.name, crop_type: selectedCrop.id },
      });
      console.log('📡 Respuesta de Edge Function:', result);
      if (err) throw new Error(err.message);
      if (!result?.success) throw new Error(result?.error || "Error desconocido");
      setData(result as PredictionResult);
      if (result.fallback) {
        setIsFallback(true);
        setStatusMsg(`⚠️ ${t("pred.fallback")}`);
      } else {
        setStatusMsg(`✅ ${t("pred.generated_ok")}`);
      }
    } catch (e: any) {
      console.error('❌ Error en predicción:', e);
      setError(e.message);
      setStatusMsg(null);
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
    const headers = "Region,Mes,Cultivo,Prob_Helada(%),Dias_Helada,Temp_Min(°C),Umbral(°C),Confianza,SPI,Prob_Sequia(%),Precip(mm),NDVI,Riesgo,Factores,Recomendaciones";
    const rows = data.predictions.map(p =>
      [data.region, p.month, selectedCrop.id, p.heladas.probabilidad, p.heladas.dias_esperados,
        p.heladas.temp_minima_predicha ?? "", p.heladas.umbral_cultivo ?? 0, p.heladas.nivel_confianza ?? "",
        p.sequia.spi_index, p.sequia.probabilidad,
        p.sequia.precipitacion_esperada_mm ?? "", p.ndvi_predicho ?? "", p.riesgo_total,
        `"${(p.heladas.factores || []).join("; ")}"`,
        `"${p.recomendaciones.join("; ")}"`].join(",")
    );
    const csv = "\uFEFF" + [headers, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `willay_prediccion_${data.region}_${selectedCrop.id}_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    setShowExport(false);
  };

  const exportJSON = () => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `willay_prediccion_${data.region}_${selectedCrop.id}_${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    setShowExport(false);
  };

  const exportPDF = () => {
    if (!data) return;
    const tableRows = data.predictions.map(p => `<tr>
      <td>${p.month_name}</td><td>${p.heladas.probabilidad}%</td><td>${p.heladas.dias_esperados}</td>
      <td>${p.heladas.temp_minima_predicha ?? "-"}°C</td><td>${p.heladas.umbral_cultivo ?? 0}°C</td>
      <td>${p.heladas.nivel_confianza ?? "-"}</td><td>${p.sequia.spi_index}</td>
      <td>${p.sequia.precipitacion_esperada_mm ?? "-"} mm</td><td>${p.ndvi_predicho ?? "-"}</td>
      <td style="color:${p.riesgo_total === "ALTO" ? "#ef4444" : p.riesgo_total === "MODERADO" ? "#f59e0b" : "#22c55e"};font-weight:bold">${p.riesgo_total}</td>
    </tr>`).join("");
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>WILLAY Predicción - ${data.region}</title>
    <style>body{font-family:Arial;margin:20px;font-size:11px}h1{color:#22c55e}
    table{width:100%;border-collapse:collapse;margin-top:12px}th,td{border:1px solid #ddd;padding:6px;text-align:center}
    th{background:#22c55e;color:white}.meta{color:#666;font-size:10px}</style></head><body>
    <h1>🌾 WILLAY - Predicción de Heladas y Sequías (Modelo v3 Multi-Factor)</h1>
    <p class="meta">Región: ${data.region} | Cultivo: ${selectedCrop.label} | Generado: ${new Date(data.generated_at).toLocaleDateString("es-PE")} | Período: ${data.forecast_period}</p>
    <table><thead><tr><th>Mes</th><th>Helada %</th><th>Días</th><th>T.Mín</th><th>Umbral</th><th>Confianza</th><th>SPI</th><th>Precip</th><th>NDVI</th><th>Riesgo</th></tr></thead>
    <tbody>${tableRows}</tbody></table>
    <h3>Modelo Multi-Factor v3</h3>
    <p>Factores: Temperatura nocturna + Duración fría + Humedad suelo + Etapa cultivo + NDVI</p>
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link to="/" className="p-2 rounded-xl bg-primary-foreground/20 hover:bg-primary-foreground/30">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-xl font-extrabold">🔮 {t("pred.title")}</h1>
                <p className="text-xs font-semibold opacity-80">{t("pred.subtitle")}</p>
              </div>
            </div>
            <LanguageToggle />
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 mt-6 space-y-5">
        {/* Region selector */}
        <div className="rounded-2xl border-2 border-border bg-card p-4">
          <label className="text-sm font-extrabold text-foreground mb-2 block">📍 {t("pred.select_region")}</label>
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

        {/* Crop selector */}
        <div className="rounded-2xl border-2 border-border bg-card p-4">
          <label className="text-sm font-extrabold text-foreground mb-2 block">🌱 {t("pred.crop_type")}</label>
          <div className="grid grid-cols-2 gap-2">
            {CROPS.map(c => (
              <button key={c.id} onClick={() => setSelectedCrop(c)}
                className={`py-2.5 px-3 rounded-xl text-sm font-bold transition-all text-left ${
                  selectedCrop.id === c.id
                    ? "bg-safe text-safe-foreground shadow-md scale-105"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}>
                <span className="block">{c.label}</span>
                <span className="block text-[10px] opacity-80">{c.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Generate button */}
        <button onClick={fetchPredictions} disabled={loading}
          className="w-full py-4 rounded-2xl bg-primary text-primary-foreground font-extrabold text-base shadow-lg hover:shadow-xl transition-all disabled:opacity-60 flex items-center justify-center gap-2">
          {loading ? <><Loader2 className="w-5 h-5 animate-spin" /> {t("pred.consulting")}</> : `🛰️ ${t("pred.generate")}`}
        </button>

        {loading && (
          <div className="rounded-2xl border-2 border-border bg-card p-4 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary mb-2" />
            <p className="text-sm font-bold text-muted-foreground">{t("pred.analyzing")} {selectedCrop.label}...</p>
            <p className="text-xs text-muted-foreground mt-1">MODIS LST + CHIRPS + NDVI · Modelo Multi-Factor v3</p>
          </div>
        )}

        {error && (
          <div className="rounded-2xl border-2 border-danger bg-danger/10 p-4">
            <p className="text-sm font-bold text-danger">❌ {error}</p>
          </div>
        )}

        {statusMsg && !loading && !error && (
          <div className={`rounded-2xl border-2 p-3 text-center text-sm font-bold ${
            isFallback ? "border-warning bg-warning/10 text-warning" : "border-safe bg-safe/10 text-safe"
          }`}>
            {statusMsg}
          </div>
        )}

        {data && (
          <>
            {/* Export + Methodology links */}
            <div className="flex justify-between items-center">
              <Link to="/metodologia" className="flex items-center gap-1 text-xs font-bold text-primary hover:underline">
                <Info className="w-3.5 h-3.5" /> {t("pred.see_methodology")}
              </Link>
              <div className="relative">
                <button onClick={() => setShowExport(!showExport)}
                  className="flex items-center gap-1 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-bold shadow">
                  <Download className="w-4 h-4" /> {t("pred.export")} <ChevronDown className="w-3 h-3" />
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

            {/* Métricas reales del modelo (walk-forward Python) */}
            <div className="rounded-2xl border-2 border-border bg-card p-4">
              <h3 className="text-base font-extrabold text-foreground mb-2">
                🧪 Validación del modelo
              </h3>
              {data.model_metrics?.heladas_precision == null ? (
                <p className="text-xs text-warning font-bold text-center">
                  ⚠️ Métricas de validación del modelo aún no disponibles
                </p>
              ) : (
                <div className="text-xs text-muted-foreground space-y-1">
                  <p className="font-bold text-foreground">
                    Modelo: {data.model_metrics.modelo ?? "random_forest"} · Walk-forward
                  </p>
                  <p>
                    ❄️ Heladas — Precisión: <b>{data.model_metrics.heladas_precision}%</b> · Recall: <b>{data.model_metrics.heladas_recall}%</b>
                    {data.model_metrics.f1_helada != null && <> · F1: <b>{(data.model_metrics.f1_helada * 100).toFixed(1)}%</b></>}
                  </p>
                  <p>
                    🌵 Sequía — Precisión: <b>{data.model_metrics.sequia_precision}%</b> · Recall: <b>{data.model_metrics.sequia_recall}%</b>
                    {data.model_metrics.f1_sequia != null && <> · F1: <b>{(data.model_metrics.f1_sequia * 100).toFixed(1)}%</b></>}
                  </p>
                  {data.model_metrics.fuente && (
                    <p className="opacity-70">Fuente: {data.model_metrics.fuente}</p>
                  )}
                </div>
              )}
            </div>

            {/* Timeline chart */}
            <div className="rounded-2xl border-2 border-border bg-card p-4">
              <h3 className="text-base font-extrabold text-foreground mb-3">📈 {t("pred.timeline")}</h3>
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

            {/* Bar chart */}
            <div className="rounded-2xl border-2 border-border bg-card p-4">
              <h3 className="text-base font-extrabold text-foreground mb-3">📊 {t("pred.frost_days_precip")}</h3>
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

            {/* Data table with confidence + factors */}
            <div className="rounded-2xl border-2 border-border bg-card overflow-hidden">
              <h3 className="text-base font-extrabold text-foreground p-4 pb-2">📋 {t("pred.detailed_table")}</h3>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs font-extrabold">{t("pred.month")}</TableHead>
                      <TableHead className="text-xs font-extrabold">{t("pred.frost")}</TableHead>
                      <TableHead className="text-xs font-extrabold">{t("pred.temp_min")}</TableHead>
                      <TableHead className="text-xs font-extrabold">SPI</TableHead>
                      <TableHead className="text-xs font-extrabold">{t("pred.risk")}</TableHead>
                      <TableHead className="text-xs font-extrabold">
                        <Shield className="w-3 h-3 inline" /> {t("pred.confidence")}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.predictions.map(p => (
                      <TableRow key={p.month} className="cursor-pointer hover:bg-muted/50" onClick={() => setExpandedMonth(expandedMonth === p.month ? null : p.month)}>
                        <TableCell className="text-xs font-bold">{p.month_name.substring(0, 3)}</TableCell>
                        <TableCell className="text-xs font-bold">{p.heladas.probabilidad}%</TableCell>
                        <TableCell className="text-xs font-bold">{p.heladas.temp_minima_predicha ?? "-"}°</TableCell>
                        <TableCell className="text-xs font-bold">{p.sequia.spi_index}</TableCell>
                        <TableCell>{riskBadge(p.riesgo_total)}</TableCell>
                        <TableCell>{confidenceBadge(p.heladas.nivel_confianza, t)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <p className="text-[10px] text-muted-foreground p-3 pt-1 text-center">
                👆 {t("pred.tap_row")}
              </p>
            </div>

            {/* Expanded month factors */}
            {expandedMonth && (() => {
              const p = data.predictions.find(pred => pred.month === expandedMonth);
              if (!p) return null;
              return (
                <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-4 animate-in fade-in">
                  <h3 className="text-sm font-extrabold text-foreground mb-2">
                    🔍 {p.month_name} — {t("pred.factors_title")}
                  </h3>
                  <div className="space-y-2">
                    {p.heladas.factores && p.heladas.factores.length > 0 && (
                      <div>
                        <p className="text-xs font-bold text-frost mb-1">❄️ {t("pred.frost_factors")}</p>
                        {p.heladas.factores.map((f, i) => (
                          <p key={i} className="text-[11px] text-muted-foreground ml-3">• {f}</p>
                        ))}
                        {p.heladas.umbral_cultivo != null && (
                          <p className="text-[10px] text-muted-foreground ml-3 mt-1">
                            🌱 Umbral {selectedCrop.label}: {p.heladas.umbral_cultivo}°C | Etapa: {p.heladas.etapa_cultivo}
                          </p>
                        )}
                      </div>
                    )}
                    {p.sequia.factores && p.sequia.factores.length > 0 && (
                      <div>
                        <p className="text-xs font-bold text-drought mb-1">🌵 {t("pred.drought_factors")}</p>
                        {p.sequia.factores.map((f, i) => (
                          <p key={i} className="text-[11px] text-muted-foreground ml-3">• {f}</p>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <Shield className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-[11px] text-muted-foreground font-bold">
                        {t("pred.confidence_level")} {confidenceBadge(p.heladas.nivel_confianza, t)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Recommendations */}
            <div className="rounded-2xl border-2 border-border bg-card p-4">
              <h3 className="text-base font-extrabold text-foreground mb-3">💡 {t("pred.recommendations")}</h3>
              <div className="space-y-3">
                {data.predictions.filter(p => p.riesgo_total !== "BAJO").slice(0, 5).map(p => (
                  <div key={p.month} className={`p-3 rounded-xl border-2 ${
                    p.riesgo_total === "ALTO" ? "border-danger bg-danger/5" : "border-warning bg-warning/5"
                  }`}>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-extrabold text-foreground">{p.month_name}</p>
                      {riskBadge(p.riesgo_total)}
                      {confidenceBadge(p.heladas.nivel_confianza, t)}
                    </div>
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
              <h3 className="text-sm font-extrabold text-foreground mb-2">📐 {t("pred.baseline")} ({data.historical_baseline.years_analyzed} {t("pred.years")})</h3>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-2 rounded-xl bg-frost/10">
                  <p className="text-lg font-extrabold text-frost">{data.historical_baseline.avg_temp_min ?? "-"}°</p>
                  <p className="text-[10px] font-bold text-muted-foreground">{t("pred.temp_min_avg")}</p>
                </div>
                <div className="p-2 rounded-xl bg-primary/10">
                  <p className="text-lg font-extrabold text-primary">{data.historical_baseline.avg_precipitation_mm ?? "-"}</p>
                  <p className="text-[10px] font-bold text-muted-foreground">{t("pred.precip_mm")}</p>
                </div>
                <div className="p-2 rounded-xl bg-safe/10">
                  <p className="text-lg font-extrabold text-safe">{data.historical_baseline.avg_ndvi ?? "-"}</p>
                  <p className="text-[10px] font-bold text-muted-foreground">{t("pred.ndvi_avg")}</p>
                </div>
              </div>
              {data.model_info && (
                <p className="text-[10px] text-muted-foreground mt-2 text-center">
                  Modelo: {data.model_info.version} | {data.model_info.data_sources?.join(", ")}
                </p>
              )}
            </div>

            {/* Link to methodology */}
            <Link to="/metodologia">
              <div className="rounded-2xl border-2 border-dashed border-primary/30 p-4 flex items-center justify-center gap-3 hover:bg-primary/5 transition-colors">
                <Info className="w-5 h-5 text-primary" />
                <div>
                  <p className="font-bold text-sm text-foreground">📐 {t("pred.methodology_link")}</p>
                  <p className="text-xs text-muted-foreground">{t("pred.methodology_desc")}</p>
                </div>
              </div>
            </Link>
          </>
        )}
      </main>
    </div>
  );
};

export default Predicciones;
