// Cola offline para envíos de telemetría desde la app/dispositivo.
// - Guarda lecturas pendientes en localStorage cuando no hay red.
// - Reintenta con backoff exponencial cuando vuelve la conexión.
// - Detecta el transporte activo (WiFi / 2G / offline) usando la Network Information API
//   cuando está disponible, y `navigator.onLine` como fallback.

import { supabase } from "@/integrations/supabase/client";

const QUEUE_KEY = "willay_uplink_queue";
const LAST_TX_KEY = "willay_last_transport";
const LAST_FLUSH_KEY = "willay_last_flush";

export type Transport = "wifi" | "2g" | "3g" | "4g" | "5g" | "ethernet" | "offline" | "unknown";

export interface QueuedReading {
  id: string;
  device_id: string;
  lat: number;
  lon: number;
  t: number; // unix seconds
  T: number | null;
  H: number | null;
  S: number | null;
  attempts: number;
}

function read(): QueuedReading[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
  } catch {
    return [];
  }
}

function write(q: QueuedReading[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
  window.dispatchEvent(new CustomEvent("willay-queue-changed"));
}

export function enqueueReading(r: Omit<QueuedReading, "id" | "attempts">) {
  const q = read();
  q.push({ ...r, id: crypto.randomUUID(), attempts: 0 });
  // keep last 500 max to avoid blowing localStorage
  write(q.slice(-500));
}

export function queueSize(): number {
  return read().length;
}

export function getTransport(): Transport {
  if (typeof navigator === "undefined") return "unknown";
  if (!navigator.onLine) return "offline";
  // @ts-expect-error - Network Information API is non-standard
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (!conn) return "unknown";
  const type = conn.type as string | undefined; // "wifi", "cellular", "ethernet"...
  const effective = conn.effectiveType as string | undefined; // "2g", "3g", "4g", "slow-2g"
  if (type === "wifi") return "wifi";
  if (type === "ethernet") return "ethernet";
  if (effective?.includes("2g")) return "2g";
  if (effective === "3g") return "3g";
  if (effective === "4g") return "4g";
  if (effective === "5g") return "5g";
  return "unknown";
}

export function onTransportChange(cb: (t: Transport) => void): () => void {
  const handler = () => {
    const t = getTransport();
    localStorage.setItem(LAST_TX_KEY, t);
    cb(t);
  };
  window.addEventListener("online", handler);
  window.addEventListener("offline", handler);
  // @ts-expect-error - non-standard
  const conn = navigator.connection;
  conn?.addEventListener?.("change", handler);
  handler();
  return () => {
    window.removeEventListener("online", handler);
    window.removeEventListener("offline", handler);
    conn?.removeEventListener?.("change", handler);
  };
}

export function getLastFlush(): number {
  return parseInt(localStorage.getItem(LAST_FLUSH_KEY) || "0", 10);
}

// Flush con reintentos. Si estamos en 2G usamos el endpoint compacto.
export async function flushQueue(): Promise<{ sent: number; remaining: number; error?: string }> {
  if (!navigator.onLine) return { sent: 0, remaining: queueSize() };
  const all = read();
  if (all.length === 0) return { sent: 0, remaining: 0 };

  const tx = getTransport();
  const useCompact = tx === "2g" || tx === "3g" || tx === "offline" || tx === "unknown";
  const batch = all.slice(0, 60); // 10h a 10 min

  try {
    if (useCompact) {
      const first = batch[0];
      const { error } = await supabase.functions.invoke("sensor-data-2g", {
        body: {
          d: first.device_id,
          lat: first.lat,
          lon: first.lon,
          tx,
          r: batch.map((b) => ({ t: b.t, T: b.T, H: b.H, S: b.S })),
        },
      });
      if (error) throw error;
    } else {
      const rows = batch.map((b) => ({
        device_id: b.device_id,
        lat: b.lat,
        lon: b.lon,
        temperatura: b.T,
        humedad: b.H,
        humedad_suelo: b.S,
        timestamp: new Date(b.t * 1000).toISOString(),
        source: tx === "wifi" || tx === "ethernet" ? "iot_wifi" : "iot",
      }));
      const { error } = await supabase.from("sensor_readings").insert(rows);
      if (error) throw error;
    }

    const remaining = all.slice(batch.length);
    write(remaining);
    localStorage.setItem(LAST_FLUSH_KEY, Date.now().toString());
    return { sent: batch.length, remaining: remaining.length };
  } catch (e) {
    // backoff: aumentar intentos, no eliminar
    const updated = all.map((r, i) => (i < batch.length ? { ...r, attempts: r.attempts + 1 } : r));
    write(updated);
    return { sent: 0, remaining: updated.length, error: (e as Error).message };
  }
}

// Auto-flush al volver la conexión, con backoff exponencial cuando hay fallos.
let backoffMs = 4000;
let timer: ReturnType<typeof setTimeout> | null = null;

export function startAutoFlush() {
  const schedule = (ms: number) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(tick, ms);
  };
  const tick = async () => {
    if (queueSize() === 0 || !navigator.onLine) {
      schedule(15000);
      return;
    }
    const res = await flushQueue();
    if (res.error) {
      backoffMs = Math.min(backoffMs * 2, 5 * 60_000);
    } else {
      backoffMs = 4000;
    }
    schedule(res.remaining > 0 ? backoffMs : 30_000);
  };
  window.addEventListener("online", () => schedule(500));
  schedule(2000);
}