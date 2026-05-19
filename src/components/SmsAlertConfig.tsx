import { useState, useEffect } from "react";
import { Phone, Plus, X, Send, Loader2, CheckCircle, History } from "lucide-react";
import { useSmsAlert } from "@/hooks/useSmsAlert";

interface SmsAlertConfigProps {
  temperatura: number | null;
  locationName: string;
  alertLevel: string;
}

type AlertHistoryEntry = {
  ts: string;
  level: string;
  temperatura: number | null;
  locationName: string;
  phones: number;
  status: "sent" | "skipped" | "error";
};

const HISTORY_KEY = "willay_sms_history";
const THRESHOLD_KEY = "willay_sms_threshold"; // "danger" | "warning"
const MAX_HISTORY = 20;

const SmsAlertConfig = ({ temperatura, locationName, alertLevel }: SmsAlertConfigProps) => {
  const [phones, setPhones] = useState<string[]>(() => {
    const saved = localStorage.getItem("willay_sms_phones");
    return saved ? JSON.parse(saved) : [];
  });
  const [fromNumber, setFromNumber] = useState(() => {
    return localStorage.getItem("willay_twilio_from") || "";
  });
  const [newPhone, setNewPhone] = useState("");
  const [showConfig, setShowConfig] = useState(false);
  const [threshold, setThreshold] = useState<"danger" | "warning">(() => {
    return (localStorage.getItem(THRESHOLD_KEY) as "danger" | "warning") || "danger";
  });
  const [history, setHistory] = useState<AlertHistoryEntry[]>(() => {
    const saved = localStorage.getItem(HISTORY_KEY);
    return saved ? JSON.parse(saved) : [];
  });
  const { sendAlert, sending, lastSent } = useSmsAlert();

  useEffect(() => {
    localStorage.setItem("willay_sms_phones", JSON.stringify(phones));
  }, [phones]);

  useEffect(() => {
    localStorage.setItem("willay_twilio_from", fromNumber);
  }, [fromNumber]);

  useEffect(() => {
    localStorage.setItem(THRESHOLD_KEY, threshold);
  }, [threshold]);

  const appendHistory = (entry: AlertHistoryEntry) => {
    setHistory((prev) => {
      const next = [entry, ...prev].slice(0, MAX_HISTORY);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      return next;
    });
  };

  // Auto-send SMS when risk level meets configured threshold
  useEffect(() => {
    const meetsThreshold =
      alertLevel === "danger" ||
      (threshold === "warning" && alertLevel === "warning");

    if (
      meetsThreshold &&
      temperatura !== null &&
      phones.length > 0 &&
      fromNumber
    ) {
      (async () => {
        const result: any = await sendAlert({
          phoneNumbers: phones,
          locationName,
          temperatura,
          fromNumber,
        });
        if (result?.skipped) return; // cooldown — don't log
        appendHistory({
          ts: new Date().toISOString(),
          level: alertLevel,
          temperatura,
          locationName,
          phones: phones.length,
          status: result?.error ? "error" : "sent",
        });
      })();
    }
  }, [alertLevel, temperatura, phones, fromNumber, locationName, sendAlert, threshold]);

  const addPhone = () => {
    const cleaned = newPhone.trim();
    if (cleaned && !phones.includes(cleaned)) {
      setPhones([...phones, cleaned]);
      setNewPhone("");
    }
  };

  const removePhone = (phone: string) => {
    setPhones(phones.filter((p) => p !== phone));
  };

  const handleManualSend = async () => {
    if (phones.length === 0 || !fromNumber) return;
    const result: any = await sendAlert({
      phoneNumbers: phones,
      locationName,
      temperatura: temperatura ?? -2,
      fromNumber,
    });
    if (!result?.skipped) {
      appendHistory({
        ts: new Date().toISOString(),
        level: "manual",
        temperatura: temperatura ?? -2,
        locationName,
        phones: phones.length,
        status: result?.error ? "error" : "sent",
      });
    }
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem(HISTORY_KEY);
  };

  return (
    <div className="bg-card rounded-2xl p-4 shadow-md border border-border">
      <button
        onClick={() => setShowConfig(!showConfig)}
        className="flex items-center gap-3 w-full text-left"
      >
        <Phone className="w-8 h-8 text-primary" />
        <div className="flex-1">
          <h3 className="text-lg font-extrabold text-foreground">📱 Alertas SMS</h3>
          <p className="text-sm text-muted-foreground">
            {phones.length > 0
              ? `${phones.length} número(s) registrado(s)`
              : "Configura para recibir alertas"}
          </p>
        </div>
        {lastSent && <CheckCircle className="w-5 h-5 text-safe" />}
      </button>

      {showConfig && (
        <div className="mt-4 space-y-3">
          {/* From number */}
          <div>
            <label className="text-sm font-bold text-foreground block mb-1">
              📞 Número Twilio (From)
            </label>
            <input
              type="tel"
              value={fromNumber}
              onChange={(e) => setFromNumber(e.target.value)}
              placeholder="+1234567890"
              className="w-full bg-muted rounded-xl px-3 py-2 text-sm border border-border text-foreground"
            />
          </div>

          {/* Phone list */}
          <div>
            <label className="text-sm font-bold text-foreground block mb-1">
              👥 Números de agricultores
            </label>
            {phones.map((phone) => (
              <div key={phone} className="flex items-center gap-2 mb-1">
                <span className="text-sm font-semibold text-foreground bg-muted rounded-lg px-3 py-1 flex-1">
                  {phone}
                </span>
                <button
                  onClick={() => removePhone(phone)}
                  className="text-destructive"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            <div className="flex gap-2">
              <input
                type="tel"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="+51 999 999 999"
                className="flex-1 bg-muted rounded-xl px-3 py-2 text-sm border border-border text-foreground"
                onKeyDown={(e) => e.key === "Enter" && addPhone()}
              />
              <button
                onClick={addPhone}
                className="bg-primary text-primary-foreground rounded-xl px-3 py-2"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Manual send */}
          <button
            onClick={handleManualSend}
            disabled={sending || phones.length === 0 || !fromNumber}
            className="w-full bg-danger text-danger-foreground rounded-xl py-3 font-bold text-base flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {sending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
            {sending ? "Enviando..." : "Enviar alerta de prueba"}
          </button>

          {lastSent && (
            <p className="text-xs text-muted-foreground text-center">
              ✅ Último envío: {new Date(lastSent).toLocaleTimeString("es")}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default SmsAlertConfig;
