CREATE TABLE public.rl_thresholds (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id TEXT NOT NULL UNIQUE,
  current_threshold DOUBLE PRECISION NOT NULL DEFAULT -1.0,
  q_values JSONB NOT NULL DEFAULT '{"-2":0,"-1.5":0,"-1":0,"-0.5":0,"0":0,"0.5":0}'::jsonb,
  n_hits INTEGER NOT NULL DEFAULT 0,
  n_false_alarms INTEGER NOT NULL DEFAULT 0,
  n_misses INTEGER NOT NULL DEFAULT 0,
  n_correct_silence INTEGER NOT NULL DEFAULT 0,
  last_calibrated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.rl_thresholds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read rl_thresholds"
ON public.rl_thresholds FOR SELECT
USING (true);

CREATE POLICY "Allow insert rl_thresholds"
ON public.rl_thresholds FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow update rl_thresholds"
ON public.rl_thresholds FOR UPDATE
USING (true);

CREATE INDEX idx_rl_thresholds_device ON public.rl_thresholds(device_id);