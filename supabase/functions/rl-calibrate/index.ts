import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Q-Learning hyperparameters
const ALPHA = 0.2;          // learning rate
const GAMMA = 0.0;          // contextual bandit (no future state)
const CANDIDATES = [-2, -1.5, -1, -0.5, 0, 0.5];

// Reward shape — automatic, derived from sensor itself (no farmer input)
const R_HIT = 10;             // alerted AND frost actually happened
const R_FALSE_ALARM = -5;     // alerted but no frost
const R_MISS = -20;           // did not alert and frost happened (worst)
const R_CORRECT_SILENCE = 1;  // did not alert and no frost

interface NightSummary {
  date: string;
  t_min: number;          // ground truth from sensor
  t_predicted_min: number; // forecast made the previous evening (we approximate from earlier evening reading + drop)
}

// Build night summaries: group by local night (18:00 → 08:00)
function buildNights(readings: any[]): NightSummary[] {
  const byNight = new Map<string, number[]>();
  const eveningTemp = new Map<string, number>();

  for (const r of readings) {
    if (r.temperatura == null) continue;
    const ts = new Date(r.timestamp);
    const hour = ts.getUTCHours();
    // Night key = the date the morning belongs to
    const nightDate = new Date(ts);
    if (hour < 8) {
      // belongs to previous evening's night
    } else if (hour >= 18) {
      nightDate.setUTCDate(nightDate.getUTCDate() + 1);
    } else {
      continue; // daytime, ignore
    }
    const key = nightDate.toISOString().slice(0, 10);
    if (!byNight.has(key)) byNight.set(key, []);
    byNight.get(key)!.push(r.temperatura);

    // capture evening temp (around 18:00–20:00) as the "forecast input"
    if (hour >= 18 && hour <= 20) {
      const cur = eveningTemp.get(key);
      if (cur === undefined || r.temperatura < cur) eveningTemp.set(key, r.temperatura);
    }
  }

  const nights: NightSummary[] = [];
  for (const [date, temps] of byNight.entries()) {
    const tMin = Math.min(...temps);
    const evening = eveningTemp.get(date);
    if (evening === undefined) continue;
    // Naive forecast model: assume temperature drops ~4°C from evening reading
    const predicted = evening - 4;
    nights.push({ date, t_min: tMin, t_predicted_min: predicted });
  }
  return nights.sort((a, b) => a.date.localeCompare(b.date));
}

function computeReward(threshold: number, predictedMin: number, actualMin: number): {
  reward: number; outcome: "hit" | "false_alarm" | "miss" | "silence";
} {
  const wouldAlert = predictedMin <= threshold;
  const frostActually = actualMin <= 0;
  if (wouldAlert && frostActually) return { reward: R_HIT, outcome: "hit" };
  if (wouldAlert && !frostActually) return { reward: R_FALSE_ALARM, outcome: "false_alarm" };
  if (!wouldAlert && frostActually) return { reward: R_MISS, outcome: "miss" };
  return { reward: R_CORRECT_SILENCE, outcome: "silence" };
}

function pickBestAction(qValues: Record<string, number>): number {
  let best = CANDIDATES[0];
  let bestQ = -Infinity;
  for (const c of CANDIDATES) {
    const q = qValues[String(c)] ?? 0;
    if (q > bestQ) { bestQ = q; best = c; }
  }
  return best;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const url = new URL(req.url);
    const deviceFilter = url.searchParams.get("device_id");
    const lookbackDays = parseInt(url.searchParams.get("days") ?? "30", 10);
    const sinceISO = new Date(Date.now() - lookbackDays * 86400000).toISOString();

    // 1. Get distinct devices with recent data
    let devicesQuery = supabase
      .from("sensor_readings")
      .select("device_id")
      .gte("timestamp", sinceISO);
    if (deviceFilter) devicesQuery = devicesQuery.eq("device_id", deviceFilter);

    const { data: devRows, error: devErr } = await devicesQuery.limit(5000);
    if (devErr) throw devErr;
    const devices = Array.from(new Set((devRows ?? []).map((r: any) => r.device_id)));

    const summary: any[] = [];

    for (const device_id of devices) {
      // 2. Pull all readings for this device
      const { data: readings, error: rErr } = await supabase
        .from("sensor_readings")
        .select("timestamp,temperatura")
        .eq("device_id", device_id)
        .gte("timestamp", sinceISO)
        .order("timestamp", { ascending: true })
        .limit(2000);
      if (rErr) throw rErr;

      const nights = buildNights(readings ?? []);
      if (nights.length < 3) {
        summary.push({ device_id, skipped: true, reason: "not enough nights", nights: nights.length });
        continue;
      }

      // 3. Load (or initialize) RL state for this device
      const { data: existing } = await supabase
        .from("rl_thresholds")
        .select("*")
        .eq("device_id", device_id)
        .maybeSingle();

      let qValues: Record<string, number> = existing?.q_values ?? {
        "-2": 0, "-1.5": 0, "-1": 0, "-0.5": 0, "0": 0, "0.5": 0,
      };
      let nHits = existing?.n_hits ?? 0;
      let nFalse = existing?.n_false_alarms ?? 0;
      let nMiss = existing?.n_misses ?? 0;
      let nSilence = existing?.n_correct_silence ?? 0;

      // 4. Replay each night for EVERY candidate threshold (off-policy bandit update)
      for (const night of nights) {
        for (const cand of CANDIDATES) {
          const { reward, outcome } = computeReward(cand, night.t_predicted_min, night.t_min);
          const key = String(cand);
          const oldQ = qValues[key] ?? 0;
          // Q ← Q + α (r − Q)   (bandit update, GAMMA=0)
          qValues[key] = oldQ + ALPHA * (reward - oldQ);

          // Only count outcomes for the action that WOULD have been selected (current best)
          // → tracked once per night below
        }
        // counters using the policy that was selected before this update batch
        const policyAction = pickBestAction(qValues);
        const { outcome } = computeReward(policyAction, night.t_predicted_min, night.t_min);
        if (outcome === "hit") nHits++;
        else if (outcome === "false_alarm") nFalse++;
        else if (outcome === "miss") nMiss++;
        else nSilence++;
      }

      const newThreshold = pickBestAction(qValues);

      // 5. Persist
      await supabase.from("rl_thresholds").upsert({
        device_id,
        current_threshold: newThreshold,
        q_values: qValues,
        n_hits: nHits,
        n_false_alarms: nFalse,
        n_misses: nMiss,
        n_correct_silence: nSilence,
        last_calibrated_at: new Date().toISOString(),
      }, { onConflict: "device_id" });

      summary.push({
        device_id,
        nights_processed: nights.length,
        new_threshold: newThreshold,
        q_values: qValues,
        stats: { hits: nHits, false_alarms: nFalse, misses: nMiss, correct_silence: nSilence },
      });
    }

    return new Response(JSON.stringify({ ok: true, devices: devices.length, summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e: any) {
    console.error("rl-calibrate error", e);
    return new Response(JSON.stringify({ error: e?.message ?? String(e) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});