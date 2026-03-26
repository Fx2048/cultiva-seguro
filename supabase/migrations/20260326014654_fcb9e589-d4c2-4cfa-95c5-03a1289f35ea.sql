CREATE TABLE public.sensor_readings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lat double precision NOT NULL,
  lon double precision NOT NULL,
  temperatura double precision,
  humedad double precision,
  humedad_suelo double precision,
  timestamp timestamptz NOT NULL DEFAULT now(),
  device_id text NOT NULL,
  source text NOT NULL DEFAULT 'iot',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sensor_readings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access for sensor_readings"
  ON public.sensor_readings FOR SELECT
  USING (true);

CREATE POLICY "Allow insert sensor_readings"
  ON public.sensor_readings FOR INSERT
  WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.sensor_readings;

CREATE INDEX idx_sensor_readings_location ON public.sensor_readings (lat, lon);
CREATE INDEX idx_sensor_readings_device ON public.sensor_readings (device_id);
CREATE INDEX idx_sensor_readings_timestamp ON public.sensor_readings (timestamp DESC);