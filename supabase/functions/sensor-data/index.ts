import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (req.method === "POST") {
      const body = await req.json();

      // Validate required fields
      const { lat, lon, temperatura, humedad, humedad_suelo, device_id, source } = body;

      if (!lat || !lon || !device_id) {
        return new Response(
          JSON.stringify({ error: "Campos requeridos: lat, lon, device_id" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data, error } = await supabase
        .from("sensor_readings")
        .insert({
          lat,
          lon,
          temperatura: temperatura ?? null,
          humedad: humedad ?? null,
          humedad_suelo: humedad_suelo ?? null,
          device_id,
          source: source || "iot",
        })
        .select()
        .single();

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (req.method === "GET") {
      const url = new URL(req.url);
      const lat = parseFloat(url.searchParams.get("lat") || "0");
      const lon = parseFloat(url.searchParams.get("lon") || "0");
      const radius = parseFloat(url.searchParams.get("radius") || "0.5"); // degrees

      const { data, error } = await supabase
        .from("sensor_readings")
        .select("*")
        .gte("lat", lat - radius)
        .lte("lat", lat + radius)
        .gte("lon", lon - radius)
        .lte("lon", lon + radius)
        .order("timestamp", { ascending: false })
        .limit(50);

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Método no soportado" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Sensor data error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
