import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/twilio';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured');

    const TWILIO_API_KEY = Deno.env.get('TWILIO_API_KEY');
    if (!TWILIO_API_KEY) throw new Error('TWILIO_API_KEY is not configured');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { phone_numbers, location_name, temperatura, from_number } = body;

    if (!phone_numbers || !Array.isArray(phone_numbers) || phone_numbers.length === 0) {
      return new Response(
        JSON.stringify({ error: "Se requiere 'phone_numbers' como array" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!from_number) {
      return new Response(
        JSON.stringify({ error: "Se requiere 'from_number' (número Twilio)" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const temp = temperatura ?? -2;
    const loc = location_name ?? "tu zona";

    // Build SMS message (max 160 chars)
    let message = `🔴 WILLAY: HELADA en 4h. Temp: ${temp}°C. ${loc}. Riega y cubre con plástico. willay.app`;
    if (message.length > 160) {
      message = `🔴 HELADA ${temp}°C en ${loc}. Riega y cubre cultivos YA. willay.app`;
    }
    if (message.length > 160) {
      message = message.substring(0, 157) + "...";
    }

    const results = [];

    for (const phone of phone_numbers) {
      let status = 'sent';
      let twilio_sid = null;
      let error_message = null;

      try {
        const response = await fetch(`${GATEWAY_URL}/Messages.json`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'X-Connection-Api-Key': TWILIO_API_KEY,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            To: phone,
            From: from_number,
            Body: message,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          status = 'failed';
          error_message = `Twilio error [${response.status}]: ${JSON.stringify(data)}`;
        } else {
          twilio_sid = data.sid;
        }
      } catch (err) {
        status = 'failed';
        error_message = err.message;
      }

      // Log to sms_logs
      await supabase.from('sms_logs').insert({
        phone_number: phone,
        message,
        alert_type: 'helada',
        location_name: loc,
        temperatura: temp,
        status,
        twilio_sid,
        error_message,
      });

      results.push({ phone, status, twilio_sid, error_message });
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('SMS alert error:', err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
