// Edge Function: sensor-data-2g
// Endpoint optimizado para datos recibidos vía SIM800 (red 2G).
// Protocolo JSON compacto en batch para minimizar bytes en GPRS:
// {
//   "d": "pi-001",                 // device_id
//   "lat": -13.52, "lon": -71.97,
//   "tx": "wifi" | "2g",           // transporte usado por la Pi
//   "r": [                          // readings batch (hasta 60 = 10 h a 10 min)
//     { "t": 1715800000, "T": 2.3, "H": 78, "S": 45 },
//     ...
//   ]
// }
// Campos abreviados: t=timestamp(s), T=temp °C, H=humedad aire %, S=humedad suelo %.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface CompactReading {
  t: number; // unix seconds
  T?: number | null;
  H?: number | null;
  S?: number | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Use POST" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json();
    const { d: device_id, lat, lon, tx = "2g", r: readings } = body ?? {};

    if (!device_id || typeof lat !== "number" || typeof lon !== "number" || !Array.isArray(readings)) {
      return new Response(
        JSON.stringify({ ok: false, error: "Campos requeridos: d, lat, lon, r[]" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (readings.length === 0) {
      return new Response(JSON.stringify({ ok: true, inserted: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Limit batch size to avoid abusive payloads via 2G
    const batch = (readings as CompactReading[]).slice(0, 200).map((x) => ({
      device_id,
      lat,
        lon,
      temperatura: typeof x.T === "number" ? x.T : null,
      humedad: typeof x.H === "number" ? x.H : null,
      humedad_suelo: typeof x.S === "number" ? x.S : null,
      timestamp: new Date((x.t ?? Date.now() / 1000) * 1000).toISOString(),
      source: tx === "wifi" ? "iot_wifi" : "iot_2g",
    }));

    const { error, count } = await supabase
      .from("sensor_readings")
      .insert(batch, { count: "exact" });

    if (error) throw error;

    // Respuesta minimalista (la Pi tiene poco ancho de banda)
    return new Response(
      JSON.stringify({ ok: true, n: count ?? batch.length, tx }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("sensor-data-2g error:", err);
    return new Response(
      JSON.stringify({ ok: false, error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});