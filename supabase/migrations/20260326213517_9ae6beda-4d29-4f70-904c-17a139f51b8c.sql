
CREATE TABLE public.sms_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number text NOT NULL,
  message text NOT NULL,
  alert_type text NOT NULL DEFAULT 'helada',
  location_name text,
  temperatura double precision,
  status text NOT NULL DEFAULT 'pending',
  twilio_sid text,
  error_message text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow insert sms_logs" ON public.sms_logs
  FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Public read access for sms_logs" ON public.sms_logs
  FOR SELECT TO public USING (true);
