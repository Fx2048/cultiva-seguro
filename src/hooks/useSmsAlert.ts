import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface SendSmsParams {
  phoneNumbers: string[];
  locationName: string;
  temperatura: number;
  fromNumber: string;
}

export const useSmsAlert = () => {
  const [sending, setSending] = useState(false);
  const [lastSent, setLastSent] = useState<string | null>(null);
  const cooldownRef = useRef(false);

  const sendAlert = useCallback(async (params: SendSmsParams) => {
    // Cooldown: don't send more than once per 30 minutes
    if (cooldownRef.current) return { skipped: true };

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-sms-alert", {
        body: {
          phone_numbers: params.phoneNumbers,
          location_name: params.locationName,
          temperatura: params.temperatura,
          from_number: params.fromNumber,
        },
      });

      if (error) throw error;

      cooldownRef.current = true;
      setLastSent(new Date().toISOString());
      setTimeout(() => { cooldownRef.current = false; }, 30 * 60 * 1000);

      return data;
    } catch (err) {
      console.error("Error enviando SMS:", err);
      return { error: err };
    } finally {
      setSending(false);
    }
  }, []);

  return { sendAlert, sending, lastSent };
};
