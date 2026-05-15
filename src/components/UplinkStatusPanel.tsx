import { useEffect, useState } from "react";
import { Wifi, Radio, WifiOff, Inbox, RefreshCw, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  flushQueue,
  getTransport,
  onTransportChange,
  queueSize,
  getLastFlush,
  type Transport,
} from "@/lib/uplinkQueue";

function fmtAgo(ts: number): string {
  if (!ts) return "nunca";
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `hace ${s}s`;
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  return `hace ${Math.floor(s / 86400)} d`;
}

const TX_LABEL: Record<Transport, string> = {
  wifi: "WiFi (Cifox)",
  ethernet: "Ethernet",
  "2g": "2G (SIM800)",
  "3g": "3G",
  "4g": "4G",
  "5g": "5G",
  offline: "Sin señal",
  unknown: "Desconocido",
};

const UplinkStatusPanel = () => {
  const [tx, setTx] = useState<Transport>(getTransport());
  const [pending, setPending] = useState<number>(queueSize());
  const [lastFlush, setLastFlush] = useState<number>(getLastFlush());
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const off = onTransportChange(setTx);
    const refresh = () => {
      setPending(queueSize());
      setLastFlush(getLastFlush());
    };
    window.addEventListener("willay-queue-changed", refresh);
    const id = setInterval(refresh, 5000);
    return () => {
      off();
      window.removeEventListener("willay-queue-changed", refresh);
      clearInterval(id);
    };
  }, []);

  const isOffline = tx === "offline";
  const is2G = tx === "2g" || tx === "3g";
  const Icon = isOffline ? WifiOff : is2G ? Radio : Wifi;

  const color = isOffline
    ? "bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-200"
    : is2G
      ? "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-200"
      : "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-200";

  const handleFlush = async () => {
    setSending(true);
    await flushQueue();
    setPending(queueSize());
    setLastFlush(getLastFlush());
    setSending(false);
  };

  return (
    <Card className="p-4 rounded-2xl border-2">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-extrabold flex items-center gap-2">
          📡 Estado de conexión
        </h3>
        <span className={`text-xs font-bold px-2 py-1 rounded-full border ${color} flex items-center gap-1`}>
          <Icon className="w-3.5 h-3.5" />
          {TX_LABEL[tx]}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl border-2 border-dashed p-3 text-center">
          <Inbox className="w-5 h-5 mx-auto text-primary" />
          <p className="text-2xl font-extrabold mt-1">{pending}</p>
          <p className="text-[11px] text-muted-foreground font-bold">
            {pending === 1 ? "lectura en cola" : "lecturas en cola"}
          </p>
        </div>
        <div className="rounded-xl border-2 border-dashed p-3 text-center">
          <CheckCircle2 className="w-5 h-5 mx-auto text-emerald-600" />
          <p className="text-sm font-extrabold mt-1">{fmtAgo(lastFlush)}</p>
          <p className="text-[11px] text-muted-foreground font-bold">último envío</p>
        </div>
      </div>

      {pending > 0 && (
        <p className="text-[11px] text-muted-foreground mt-3 leading-tight">
          {isOffline
            ? "🔌 Los datos se enviarán automáticamente cuando vuelva la señal."
            : is2G
              ? "📶 Enviando en modo compacto (2G) vía SIM800."
              : "🛰️ Reintento automático en curso..."}
        </p>
      )}

      <Button
        onClick={handleFlush}
        disabled={sending || isOffline || pending === 0}
        className="w-full mt-3"
        size="sm"
        variant="secondary"
      >
        <RefreshCw className={`w-4 h-4 mr-2 ${sending ? "animate-spin" : ""}`} />
        {sending ? "Enviando…" : "Forzar envío ahora"}
      </Button>
    </Card>
  );
};

export default UplinkStatusPanel;