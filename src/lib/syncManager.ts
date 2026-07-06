import { supabase } from "@/integrations/supabase/client";
import { willayDB, type SensorReading, type SMSLogRecord } from "./indexedDB";

const SYNC_KEY = "willay_last_sync";

/* =========================
   SYNC STATE
========================= */

export function getLastSync(): number {
  return parseInt(localStorage.getItem(SYNC_KEY) || "0", 10);
}

function setLastSync() {
  localStorage.setItem(SYNC_KEY, Date.now().toString());
}

/* =========================
   UI HELPERS
========================= */

export function getTimeSinceSync(): string {
  const last = getLastSync();
  if (!last) return "Nunca sincronizado";

  const diff = Date.now() - last;
  const mins = Math.floor(diff / 60000);

  if (mins < 1) return "Hace menos de 1 min";
  if (mins < 60) return `Hace ${mins} min`;

  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Hace ${hours}h`;

  return `Hace ${Math.floor(hours / 24)}d`;
}

/* =========================
   PUSH (LOCAL → CLOUD)
========================= */

export async function syncToCloud(): Promise<{ synced: number; errors: string[] }> {
  const errors: string[] = [];
  let synced = 0;

  try {
    const unsynced = await willayDB.getUnsyncedSensors();

    if (unsynced.length > 0) {
      const batch = unsynced.slice(0, 100);

      const rows = batch.map((r) => ({
        id: r.id,
        device_id: r.device_id,
        lat: r.lat,
        lon: r.lon,
        temperatura: r.temperatura,
        humedad: r.humedad_aire,
        humedad_suelo: r.humedad_suelo,
        timestamp: new Date(r.timestamp).toISOString(),
        source: "local_sync",
      }));

      const { error } = await supabase
        .from("sensor_readings")
        .upsert(rows, { onConflict: "id" });

      if (error) {
        errors.push(`Sensores: ${error.message}`);
      } else {
        await willayDB.markSynced(batch.map((r) => r.id));
        synced += batch.length;
      }
    }
  } catch (e: any) {
    errors.push(e.message || "Error de sincronización");
  }

  // SOLO actualizar si realmente hubo sync exitoso
  if (errors.length === 0) setLastSync();

  return { synced, errors };
}

/* =========================
   PULL (CLOUD → LOCAL)
========================= */

export async function pullFromCloud(): Promise<{ sensors: number; smsLogs: number }> {
  let sensors = 0;
  let smsLogs = 0;

  try {
    /* =========================================================
       SENSOR READINGS
       FIX: NO usar "since" como filtro (evita pérdida de datos)
    ========================================================= */

    const { data: sensorData, error: sensorError } = await supabase
      .from("sensor_readings")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);

    if (sensorError) {
      console.error("Sensor pull error:", sensorError);
    }

    if (sensorData && sensorData.length > 0) {
      const records: SensorReading[] = sensorData.map((r) => ({
        id: r.id,
        device_id: r.device_id,
        timestamp: new Date(r.timestamp).getTime(),
        temperatura: r.temperatura,
        humedad_aire: r.humedad,
        humedad_suelo: r.humedad_suelo,
        lat: r.lat,
        lon: r.lon,
        alerta: r.alerta ?? null,
        sincronizado: true,
      }));

      await willayDB.addManySensorReadings(records);
      sensors = records.length;
    }

    /* =========================
       SMS LOGS
    ========================= */

    const { data: smsData, error: smsError } = await supabase
      .from("sms_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);

    if (smsError) {
      console.error("SMS pull error:", smsError);
    }

    if (smsData && smsData.length > 0) {
      const logs: SMSLogRecord[] = smsData.map((r) => ({
        id: r.id,
        phone_number: r.phone_number,
        message: r.message,
        alert_type: r.alert_type,
        location_name: r.location_name,
        temperatura: r.temperatura,
        status: r.status,
        created_at: r.created_at,
        twilio_sid: r.twilio_sid,
        error_message: r.error_message,
      }));

      await willayDB.addSMSLogs(logs);
      smsLogs = logs.length;
    }

    // IMPORTANTE: esto solo marca actividad de sync, no cursor de datos
    setLastSync();
  } catch (e) {
    console.error("Pull error:", e);
  }

  return { sensors, smsLogs };
}

/* =========================
   STORAGE USAGE
========================= */

export function getStorageUsage(): { usedKB: number; percentUsed: number } {
  let total = 0;

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);

    if (key?.startsWith("willay_")) {
      total += (localStorage.getItem(key) || "").length * 2;
    }
  }

  const usedKB = Math.round(total / 1024);

  return {
    usedKB,
    percentUsed: Math.round((total / (5 * 1024 * 1024)) * 100),
  };
}
