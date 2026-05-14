import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface RLThresholdState {
  threshold: number;          // current learned frost threshold (°C)
  isLearned: boolean;         // false = using default, true = calibrated by RL
  stats: {
    hits: number;
    false_alarms: number;
    misses: number;
    correct_silence: number;
  };
  lastCalibrated: string | null;
  qValues: Record<string, number> | null;
}

const DEFAULT_THRESHOLD = -1.0;

/**
 * Reads the per-device frost threshold learned automatically by the
 * `rl-calibrate` edge function. The agent observes the actual minimum
 * temperature each night (sensor ground truth) and updates a Q-table —
 * no farmer feedback needed.
 */
export function useRLThreshold(deviceId: string | null) {
  const [state, setState] = useState<RLThresholdState>({
    threshold: DEFAULT_THRESHOLD,
    isLearned: false,
    stats: { hits: 0, false_alarms: 0, misses: 0, correct_silence: 0 },
    lastCalibrated: null,
    qValues: null,
  });

  useEffect(() => {
    if (!deviceId) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("rl_thresholds")
        .select("*")
        .eq("device_id", deviceId)
        .maybeSingle();

      if (cancelled || error || !data) return;
      setState({
        threshold: data.current_threshold,
        isLearned: true,
        stats: {
          hits: data.n_hits,
          false_alarms: data.n_false_alarms,
          misses: data.n_misses,
          correct_silence: data.n_correct_silence,
        },
        lastCalibrated: data.last_calibrated_at,
        qValues: data.q_values as Record<string, number>,
      });
    })();
    return () => { cancelled = true; };
  }, [deviceId]);

  /** Trigger a recalibration cycle for this device on demand. */
  const recalibrate = async () => {
    if (!deviceId) return;
    await supabase.functions.invoke("rl-calibrate", {
      body: {},
      method: "POST",
    });
  };

  return { ...state, recalibrate };
}