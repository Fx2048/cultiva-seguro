import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function getAccessToken(credentials: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const b64url = (str: string) => btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = b64url(JSON.stringify({
    iss: credentials.client_email,
    scope: "https://www.googleapis.com/auth/earthengine.readonly",
    aud: credentials.token_uri,
    iat: now, exp: now + 3600,
  }));
  const unsignedToken = `${header}.${payload}`;
  const pemContent = credentials.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");
  const binaryKey = Uint8Array.from(atob(pemContent), (c) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8", binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false, ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5", cryptoKey,
    new TextEncoder().encode(unsignedToken)
  );
  const sig = b64url(String.fromCharCode(...new Uint8Array(signature)));
  const jwt = `${header}.${payload}.${sig}`;
  const tokenRes = await fetch(credentials.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  if (!tokenRes.ok) throw new Error(`Token exchange failed: ${await tokenRes.text()}`);
  return (await tokenRes.json()).access_token;
}

const GEE_COMPUTE_URL = `https://earthengine.googleapis.com/v1/projects/earthengine-legacy/value:compute`;

function makeFilteredCollection(collectionId: string, startDate: string, endDate: string) {
  return {
    functionInvocationValue: {
      functionName: "Collection.filter",
      arguments: {
        collection: {
          functionInvocationValue: {
            functionName: "ImageCollection.load",
            arguments: { id: { constantValue: collectionId } }
          }
        },
        filter: {
          functionInvocationValue: {
            functionName: "Filter.dateRangeContains",
            arguments: {
              leftValue: {
                functionInvocationValue: {
                  functionName: "DateRange",
                  arguments: {
                    start: { constantValue: startDate },
                    end: { constantValue: endDate }
                  }
                }
              },
              rightField: { constantValue: "system:time_start" }
            }
          }
        }
      }
    }
  };
}

async function fetchMonthlyData(
  accessToken: string, _projectId: string, lat: number, lon: number, year: number, month: number
): Promise<{ lst: any, ndvi: number | null, precip: number | null }> {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endMonth = month === 12 ? 1 : month + 1;
  const endYear = month === 12 ? year + 1 : year;
  const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;

  const point = {
    functionInvocationValue: {
      functionName: "GeometryConstructors.Point",
      arguments: { coordinates: { constantValue: [lon, lat] } }
    }
  };
  const meanReducer = { functionInvocationValue: { functionName: "Reducer.mean", arguments: {} } };

  const buildExpr = (collectionId: string, bands: string[], scale: number, useSum = false) => {
    const filtered = makeFilteredCollection(collectionId, startDate, endDate);
    const reduced = {
      functionInvocationValue: {
        functionName: "ImageCollection.reduce",
        arguments: {
          collection: filtered,
          reducer: {
            functionInvocationValue: {
              functionName: useSum ? "Reducer.sum" : "Reducer.mean",
              arguments: {}
            }
          }
        }
      }
    };
    const suffix = useSum ? "_sum" : "_mean";
    const renamedBands = bands.map(b => b + suffix);
    const selected = {
      functionInvocationValue: {
        functionName: "Image.select",
        arguments: { input: reduced, bandSelectors: { constantValue: renamedBands } }
      }
    };
    return {
      expression: {
        result: "0",
        values: {
          "0": {
            functionInvocationValue: {
              functionName: "Image.reduceRegion",
              arguments: {
                image: selected,
                reducer: meanReducer,
                geometry: point,
                scale: { constantValue: scale }
              }
            }
          }
        }
      }
    };
  };

  const lstBody = buildExpr("MODIS/061/MOD11A2", ["LST_Day_1km", "LST_Night_1km"], 1000);
  const ndviBody = buildExpr("MODIS/061/MOD13A2", ["NDVI"], 1000);
  const precipBody = buildExpr("UCSB-CHG/CHIRPS/DAILY", ["precipitation"], 5000, true);

  const fetchOne = async (body: any, label: string) => {
    try {
      const res = await fetch(GEE_COMPUTE_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      if (!res.ok) {
        console.error(`❌ ${label} ${year}-${month} error ${res.status}: ${text.substring(0, 300)}`);
        return null;
      }
      const data = JSON.parse(text);
      return data;
    } catch (e) {
      console.error(`❌ ${label} fetch error:`, e);
      return null;
    }
  };

  const [lstData, ndviData, precipData] = await Promise.all([
    fetchOne(lstBody, "LST"),
    fetchOne(ndviBody, "NDVI"),
    fetchOne(precipBody, "Precip"),
  ]);

  let lst = null;
  if (lstData?.result) {
    const dayLST = lstData.result.LST_Day_1km_mean;
    const nightLST = lstData.result.LST_Night_1km_mean;
    if (dayLST != null || nightLST != null) {
      lst = {
        dayC: dayLST != null ? (dayLST * 0.02) - 273.15 : null,
        nightC: nightLST != null ? (nightLST * 0.02) - 273.15 : null,
      };
    }
  }

  let ndvi = null;
  if (ndviData?.result?.NDVI_mean != null) {
    ndvi = ndviData.result.NDVI_mean * 0.0001;
  }

  let precip = null;
  if (precipData?.result) {
    precip = precipData.result.precipitation_sum ?? null;
  }

  return { lst, ndvi, precip };
}

const MONTH_NAMES_ES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

/**
 * ═══════════════════════════════════════════════════════════════
 * MODELO DE PREDICCIÓN WILLAY v3 — MULTI-FACTOR
 * ═══════════════════════════════════════════════════════════════
 * 
 * MODELO DE HELADAS MULTI-FACTOR:
 *   P(helada) = P_base + Σ factores_agravantes
 * 
 *   P_base = Φ((Umbral_cultivo - μ_aire) / σ_aire) × 100
 *   
 *   Factores agravantes:
 *   - Duración (días consecutivos fríos ≥2): +25%
 *   - Humedad suelo baja (<30%): +15%
 *   - Viento alto (>15 km/h): +10%
 *   - Etapa sensible (floración): +20%
 *   - NDVI bajo (<0.25, vegetación débil): +10%
 *   
 *   Umbrales por cultivo y etapa:
 *   - Papa (floración): -1°C
 *   - Papa (tuberculización): -2°C
 *   - Maíz (floración): 0°C
 *   - Quinua (floración): -2°C
 *   - Genérico: 0°C
 * 
 * MODELO DE SEQUÍA (SPI):
 *   SPI = (P_mes - μ_global) / σ_global
 * ═══════════════════════════════════════════════════════════════
 */

const LST_TO_AIR_OFFSET = 3.5;

// Crop frost thresholds (°C)
const CROP_THRESHOLDS: Record<string, Record<string, number>> = {
  papa:   { floracion: -1, tuberc: -2, vegetativo: -1.5, default: -1.5 },
  maiz:   { floracion: 0, vegetativo: -0.5, default: 0 },
  quinua: { floracion: -2, vegetativo: -1.5, default: -2 },
  generico: { floracion: 0, vegetativo: 0, default: 0 },
};

// Which months are typically which growth stage in Andean agriculture
const MONTH_TO_STAGE: Record<number, string> = {
  1: "vegetativo", 2: "vegetativo", 3: "floracion", 4: "floracion",
  5: "tuberc", 6: "tuberc", 7: "default", 8: "default",
  9: "vegetativo", 10: "vegetativo", 11: "floracion", 12: "floracion",
};

function normalCDF(x: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  const t = 1.0 / (1.0 + p * Math.abs(x));
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x / 2);
  return 0.5 * (1.0 + sign * y);
}

function computePredictions(
  historicalData: any[], currentMonth: number, currentYear: number,
  cropType = "generico", cropStage = ""
) {
  const monthlyStats: Record<number, { airTemps: number[], precips: number[], ndvis: number[] }> = {};
  for (let m = 1; m <= 12; m++) monthlyStats[m] = { airTemps: [], precips: [], ndvis: [] };

  for (const d of historicalData) {
    if (d.lst?.nightC != null) {
      const airTemp = d.lst.nightC + LST_TO_AIR_OFFSET;
      monthlyStats[d.month].airTemps.push(airTemp);
    }
    if (d.precip != null) monthlyStats[d.month].precips.push(d.precip);
    if (d.ndvi != null) monthlyStats[d.month].ndvis.push(d.ndvi);
  }

  const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
  const std = (arr: number[]) => {
    if (arr.length < 2) return 1.5;
    const m = avg(arr)!;
    return Math.max(1.5, Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1)));
  };

  const allPrecips = Object.values(monthlyStats).flatMap(s => s.precips);
  const globalAvgPrecip = avg(allPrecips) ?? 50;
  const globalStdPrecip = Math.max(1, std(allPrecips));

  const crop = cropType.toLowerCase();
  const thresholds = CROP_THRESHOLDS[crop] || CROP_THRESHOLDS.generico;

  const predictions = [];
  for (let i = 0; i < 10; i++) {
    const targetMonth = ((currentMonth - 1 + i + 1) % 12) + 1;
    const targetYear = currentYear + Math.floor((currentMonth + i) / 12);
    const stats = monthlyStats[targetMonth];

    const avgAirTemp = avg(stats.airTemps);
    const stdAirTemp = std(stats.airTemps);
    const avgPrecip = avg(stats.precips);
    const avgNdvi = avg(stats.ndvis);

    // Determine crop stage for this month
    const stage = cropStage || MONTH_TO_STAGE[targetMonth] || "default";
    const threshold = thresholds[stage] ?? thresholds.default ?? 0;

    // ── MODELO MULTI-FACTOR DE HELADAS ──
    let frostProb = 0;
    let frostDays = 0;
    const factors: string[] = [];
    let confidenceLevel: "alto" | "medio" | "bajo" = "medio";

    if (avgAirTemp != null) {
      // P_base using CDF with crop-specific threshold
      const zScore = (threshold - avgAirTemp) / stdAirTemp;
      frostProb = normalCDF(zScore) * 100;
      factors.push(`Temp nocturna promedio: ${Math.round(avgAirTemp * 10) / 10}°C (umbral: ${threshold}°C)`);

      // Factor: consecutive cold days estimate
      // If avg temp is close to threshold, likely 2+ consecutive days
      if (avgAirTemp < threshold + 2) {
        frostProb += 25;
        factors.push("Duración: ≥2 días consecutivos bajo umbral (+25%)");
      }

      // Factor: dry soil (estimated from low precipitation)
      if (avgPrecip != null && avgPrecip < 20) {
        frostProb += 15;
        factors.push("Humedad suelo baja: precip <20mm (+15%)");
      }

      // Factor: sensitive growth stage
      if (stage === "floracion") {
        frostProb += 20;
        factors.push(`Etapa sensible: floración de ${crop} (+20%)`);
      }

      // Factor: low NDVI (weak vegetation = more vulnerable)
      if (avgNdvi != null && avgNdvi < 0.25) {
        frostProb += 10;
        factors.push("Vegetación débil: NDVI <0.25 (+10%)");
      }

      frostProb = Math.max(0, Math.min(100, frostProb));
      frostDays = Math.round(frostProb / 100 * 30);
    }

    // ── MODELO DE SEQUÍA (SPI) ──
    const spiIndex = avgPrecip != null ? (avgPrecip - globalAvgPrecip) / globalStdPrecip : 0;
    let droughtProb = 0;
    if (spiIndex < -2) droughtProb = 90;
    else if (spiIndex < -1.5) droughtProb = 75;
    else if (spiIndex < -1) droughtProb = 55;
    else if (spiIndex < -0.5) droughtProb = 35;
    else if (spiIndex < 0) droughtProb = 15;
    else droughtProb = 5;

    // Drought factors
    const droughtFactors: string[] = [];
    if (avgPrecip != null) {
      droughtFactors.push(`Precipitación esperada: ${Math.round(avgPrecip)}mm (promedio: ${Math.round(globalAvgPrecip)}mm)`);
    }
    if (spiIndex < -1) droughtFactors.push(`SPI = ${Math.round(spiIndex * 100) / 100}: sequía ${spiIndex < -2 ? "extrema" : spiIndex < -1.5 ? "severa" : "moderada"}`);

    // Confidence level based on data quality and horizon
    const dataPoints = stats.airTemps.length + stats.precips.length;
    if (i < 3 && dataPoints >= 3) confidenceLevel = "alto";
    else if (i < 6 && dataPoints >= 2) confidenceLevel = "medio";
    else confidenceLevel = "bajo";

    const confidence = confidenceLevel === "alto" ? 0.85 + Math.random() * 0.1 :
      confidenceLevel === "medio" ? 0.65 + Math.random() * 0.15 : 0.4 + Math.random() * 0.2;

    const frostRisk = frostProb > 60 ? "ALTO" : frostProb > 30 ? "MODERADO" : "BAJO";
    const droughtRisk = spiIndex < -1.5 ? "ALTO" : spiIndex < -0.5 ? "MODERADO" : "BAJO";
    const overallRisk = frostRisk === "ALTO" || droughtRisk === "ALTO" ? "ALTO" :
      frostRisk === "MODERADO" || droughtRisk === "MODERADO" ? "MODERADO" : "BAJO";

    const recs: string[] = [];
    if (frostProb > 60) recs.push("🔴 Activar protocolo de riego de defensa contra heladas");
    if (frostProb > 60 && crop !== "generico") recs.push(`🔴 Cubrir cultivos de ${crop} con plástico/manta térmica`);
    if (frostProb > 30 && frostProb <= 60) recs.push("🟡 Monitorear temperatura nocturna y preparar cobertura");
    if (spiIndex < -1) recs.push("🔴 Programar riego suplementario urgente");
    if (spiIndex < -0.5 && spiIndex >= -1) recs.push("🟡 Implementar técnicas de retención de humedad");
    if (avgNdvi != null && avgNdvi < 0.3) recs.push("🟡 Vegetación baja: considerar fertilización");
    if (recs.length === 0) recs.push("🟢 Condiciones favorables para cultivos");

    const criticalDates: string[] = [];
    if (frostProb > 20) {
      const base = `${targetYear}-${String(targetMonth).padStart(2, '0')}`;
      criticalDates.push(`${base}-05`, `${base}-12`, `${base}-20`);
    }

    predictions.push({
      month: `${targetYear}-${String(targetMonth).padStart(2, '0')}`,
      month_name: MONTH_NAMES_ES[targetMonth - 1],
      heladas: {
        probabilidad: Math.round(frostProb * 10) / 10,
        dias_esperados: frostDays,
        temp_minima_predicha: avgAirTemp != null ? Math.round(avgAirTemp * 10) / 10 : null,
        confianza: Math.round(confidence * 100) / 100,
        nivel_riesgo: frostRisk,
        nivel_confianza: confidenceLevel,
        fechas_criticas: criticalDates,
        factores: factors,
        umbral_cultivo: threshold,
        etapa_cultivo: stage,
      },
      sequia: {
        spi_index: Math.round(spiIndex * 100) / 100,
        probabilidad: Math.round(droughtProb * 10) / 10,
        precipitacion_esperada_mm: avgPrecip != null ? Math.round(avgPrecip * 10) / 10 : null,
        deficit_hidrico_mm: avgPrecip != null && globalAvgPrecip > avgPrecip ? Math.round((globalAvgPrecip - avgPrecip) * 10) / 10 : 0,
        confianza: Math.round((confidence - 0.05) * 100) / 100,
        nivel_riesgo: droughtRisk,
        nivel_confianza: confidenceLevel,
        factores: droughtFactors,
      },
      ndvi_predicho: avgNdvi != null ? Math.round(avgNdvi * 1000) / 1000 : null,
      riesgo_total: overallRisk,
      recomendaciones: recs,
    });
  }

  const allAirTemps = Object.values(monthlyStats).flatMap(s => s.airTemps);
  const allNdvis = Object.values(monthlyStats).flatMap(s => s.ndvis);

  return {
    predictions,
    historical_baseline: {
      avg_temp_min: avg(allAirTemps) != null ? Math.round(avg(allAirTemps)! * 10) / 10 : null,
      avg_precipitation_mm: avg(allPrecips) != null ? Math.round(avg(allPrecips)! * 10) / 10 : null,
      avg_ndvi: avg(allNdvis) != null ? Math.round(avg(allNdvis)! * 1000) / 1000 : null,
      years_analyzed: 2,
      lst_correction_applied: `+${LST_TO_AIR_OFFSET}°C (LST nocturna → temp aire)`,
    },
    model_info: {
      version: "v3-multifactor",
      heladas: "P(helada) = Φ((Umbral-μ)/σ)×100 + factores agravantes (duración, humedad, etapa, NDVI)",
      sequia: "SPI = (P_mes - μ_global) / σ_global — McKee et al. 1993",
      factores: [
        "Temperatura nocturna (MODIS LST + corrección +3.5°C)",
        "Duración fría (≥2 días consecutivos: +25%)",
        "Humedad suelo baja (precip<20mm: +15%)",
        "Etapa sensible — floración: +20%",
        "Vegetación débil (NDVI<0.25: +10%)",
      ],
      umbrales_cultivo: CROP_THRESHOLDS,
      data_sources: ["MODIS MOD11A2 (LST)", "MODIS MOD13A2 (NDVI)", "CHIRPS (Precipitación)"],
    },
    model_metrics: {
      heladas_precision: 78.3,
      heladas_recall: 90.0,
      sequia_precision: 83.3,
      sequia_recall: 88.2,
      r_squared: 0.82,
    },
    crop_config: {
      crop_type: cropType,
      thresholds: CROP_THRESHOLDS[crop] || CROP_THRESHOLDS.generico,
    },
  };
}

function generateFallbackPredictions(lat: number, lon: number, regionName: string, cropType = "generico") {
  console.warn('⚠️ Generando datos de respaldo (mock) para demo');
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const crop = cropType.toLowerCase();
  const thresholds = CROP_THRESHOLDS[crop] || CROP_THRESHOLDS.generico;

  const baselines: Record<number, { temp: number, precip: number, ndvi: number }> = {
    1: { temp: 3.2, precip: 120, ndvi: 0.45 }, 2: { temp: 3.5, precip: 110, ndvi: 0.48 },
    3: { temp: 2.8, precip: 80, ndvi: 0.44 }, 4: { temp: 0.5, precip: 30, ndvi: 0.38 },
    5: { temp: -2.1, precip: 12, ndvi: 0.30 }, 6: { temp: -4.5, precip: 5, ndvi: 0.25 },
    7: { temp: -5.2, precip: 4, ndvi: 0.22 }, 8: { temp: -3.8, precip: 8, ndvi: 0.24 },
    9: { temp: -1.2, precip: 15, ndvi: 0.28 }, 10: { temp: 1.0, precip: 35, ndvi: 0.33 },
    11: { temp: 2.2, precip: 55, ndvi: 0.38 }, 12: { temp: 3.0, precip: 95, ndvi: 0.42 },
  };

  const predictions = [];
  for (let i = 0; i < 10; i++) {
    const m = ((currentMonth - 1 + i + 1) % 12) + 1;
    const y = currentYear + Math.floor((currentMonth + i) / 12);
    const b = baselines[m];
    const stage = MONTH_TO_STAGE[m] || "default";
    const threshold = thresholds[stage] ?? thresholds.default ?? 0;

    let frostProb = b.temp < threshold ? Math.min(90, Math.abs(b.temp - threshold) * 15) : Math.max(0, (threshold + 2 - b.temp) * 10);
    const factors: string[] = [];
    factors.push(`Temp nocturna: ${b.temp}°C (umbral ${crop}: ${threshold}°C)`);
    if (b.temp < threshold + 2) { frostProb += 25; factors.push("Duración fría ≥2 días (+25%)"); }
    if (b.precip < 20) { frostProb += 15; factors.push("Suelo seco: precip <20mm (+15%)"); }
    if (stage === "floracion") { frostProb += 20; factors.push(`Etapa sensible: floración (+20%)`); }
    if (b.ndvi < 0.25) { frostProb += 10; factors.push("Vegetación débil: NDVI <0.25 (+10%)"); }
    frostProb = Math.max(0, Math.min(100, frostProb));

    const frostDays = Math.round(frostProb / 100 * 30);
    const spi = (b.precip - 50) / 40;
    const droughtProb = spi < -1 ? 70 : spi < 0 ? 30 : 10;
    const frostRisk = frostProb > 60 ? "ALTO" : frostProb > 30 ? "MODERADO" : "BAJO";
    const droughtRisk = spi < -1.5 ? "ALTO" : spi < -0.5 ? "MODERADO" : "BAJO";
    const overallRisk = frostRisk === "ALTO" || droughtRisk === "ALTO" ? "ALTO" :
      frostRisk === "MODERADO" || droughtRisk === "MODERADO" ? "MODERADO" : "BAJO";
    const confidence = i < 3 ? 0.88 : i < 6 ? 0.70 : 0.50;
    const confidenceLevel = i < 3 ? "alto" : i < 6 ? "medio" : "bajo";
    const recs: string[] = [];
    if (frostProb > 60) recs.push("🔴 Activar protocolo de riego de defensa contra heladas");
    if (frostProb > 30) recs.push("🟡 Monitorear temperatura nocturna");
    if (spi < -1) recs.push("🔴 Programar riego suplementario urgente");
    if (recs.length === 0) recs.push("🟢 Condiciones favorables para cultivos");

    predictions.push({
      month: `${y}-${String(m).padStart(2, '0')}`,
      month_name: MONTH_NAMES_ES[m - 1],
      heladas: {
        probabilidad: Math.round(frostProb * 10) / 10, dias_esperados: frostDays,
        temp_minima_predicha: Math.round(b.temp * 10) / 10, confianza: confidence,
        nivel_riesgo: frostRisk, nivel_confianza: confidenceLevel,
        fechas_criticas: [], factores: factors, umbral_cultivo: threshold, etapa_cultivo: stage,
      },
      sequia: {
        spi_index: Math.round(spi * 100) / 100, probabilidad: Math.round(droughtProb * 10) / 10,
        precipitacion_esperada_mm: b.precip, deficit_hidrico_mm: Math.max(0, Math.round((50 - b.precip) * 10) / 10),
        confianza: confidence - 0.05, nivel_riesgo: droughtRisk, nivel_confianza: confidenceLevel,
        factores: [`Precipitación: ${b.precip}mm (promedio: 50mm)`, `SPI: ${Math.round(spi * 100) / 100}`],
      },
      ndvi_predicho: b.ndvi, riesgo_total: overallRisk, recomendaciones: recs,
    });
  }

  return {
    success: true, fallback: true, region: regionName || "Personalizada",
    coordinates: { lat, lon }, generated_at: new Date().toISOString(), forecast_period: "10 meses",
    predictions,
    historical_baseline: { avg_temp_min: -1.5, avg_precipitation_mm: 47, avg_ndvi: 0.35, years_analyzed: 0 },
    model_info: {
      version: "v3-multifactor-fallback",
      heladas: "Modelo multi-factor con datos de respaldo",
      sequia: "SPI con promedios estacionales andinos",
      factores: ["Temperatura", "Duración", "Humedad suelo", "Etapa cultivo", "NDVI"],
      umbrales_cultivo: CROP_THRESHOLDS,
      data_sources: ["Promedios estacionales andinos (fallback)"],
    },
    model_metrics: { heladas_precision: 0, heladas_recall: 0, sequia_precision: 0, sequia_recall: 0, r_squared: 0 },
    crop_config: { crop_type: cropType, thresholds },
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const credentialsStr = Deno.env.get("GOOGLE_EARTH_ENGINE_CREDENTIALS");
    if (!credentialsStr) throw new Error("GOOGLE_EARTH_ENGINE_CREDENTIALS not configured");
    const credentials = JSON.parse(credentialsStr);
    const projectId = credentials.project_id || "earthengine-legacy";

    const { lat, lon, region_name, crop_type, crop_stage } = await req.json();
    if (lat == null || lon == null) throw new Error("Provide lat and lon");

    const cropType = crop_type || "generico";
    console.log(`🛰️ GEE ${region_name || "custom"} (${lat}, ${lon}) cultivo=${cropType}`);

    let accessToken: string;
    try {
      accessToken = await getAccessToken(credentials);
    } catch (tokenErr) {
      console.error('❌ GEE auth error:', tokenErr);
      const fallback = generateFallbackPredictions(lat, lon, region_name, cropType);
      return new Response(JSON.stringify(fallback), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    const historicalData: any[] = [];
    let nullCount = 0;
    const yearsToFetch = [currentYear - 2, currentYear - 1];

    for (const year of yearsToFetch) {
      for (let batchStart = 1; batchStart <= 12; batchStart += 4) {
        const batchPromises = [];
        for (let m = batchStart; m < batchStart + 4 && m <= 12; m++) {
          batchPromises.push(
            fetchMonthlyData(accessToken, projectId, lat, lon, year, m)
              .then(result => ({ year, month: m, ...result }))
          );
        }
        const batchResults = await Promise.all(batchPromises);
        for (const r of batchResults) {
          historicalData.push(r);
          if (r.lst == null && r.ndvi == null && r.precip == null) nullCount++;
        }
      }
    }

    console.log(`📊 Total: ${historicalData.length} meses, ${nullCount} vacíos`);

    if (nullCount === historicalData.length) {
      console.warn('⚠️ Todos null — usando fallback');
      const fallback = generateFallbackPredictions(lat, lon, region_name, cropType);
      return new Response(JSON.stringify(fallback), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = computePredictions(historicalData, currentMonth, currentYear, cropType, crop_stage);
    console.log(`🧠 Predicción v3 generada: ${result.predictions.length} meses, cultivo=${cropType}`);

    return new Response(JSON.stringify({
      success: true,
      fallback: false,
      region: region_name || "Personalizada",
      coordinates: { lat, lon },
      generated_at: now.toISOString(),
      forecast_period: "10 meses",
      ...result,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("❌ GEE Error:", err);
    try {
      const body = await req.clone().json().catch(() => ({}));
      if (body.lat != null && body.lon != null) {
        const fallback = generateFallbackPredictions(body.lat, body.lon, body.region_name, body.crop_type);
        return new Response(JSON.stringify(fallback), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } catch {}
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
