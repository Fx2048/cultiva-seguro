const DB_NAME = "willay_db";
const DB_VERSION = 1;

const STORES = {
  sensors: "sensor_readings",
  ndvi: "ndvi_data",
  smsLogs: "sms_logs",
} as const;

export interface SensorReading {
  id: string;
  device_id: string;
  timestamp: number;
  temperatura: number | null;
  humedad_aire: number | null;
  humedad_suelo: number | null;
  ndvi?: number | null;
  alerta: string | null;
  lat: number;
  lon: number;
  sincronizado: boolean;
}

export interface NDVIRecord {
  id: string;
  lat: number;
  lon: number;
  ndvi: number;
  timestamp: number;
  source: string;
}

export interface SMSLogRecord {
  id: string;
  phone_number: string;
  message: string;
  alert_type: string;
  location_name: string | null;
  temperatura: number | null;
  status: string;
  created_at: string;
  twilio_sid: string | null;
  error_message: string | null;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORES.sensors)) {
        const store = db.createObjectStore(STORES.sensors, { keyPath: "id" });
        store.createIndex("timestamp", "timestamp");
        store.createIndex("device_id", "device_id");
        store.createIndex("sincronizado", "sincronizado");
      }
      if (!db.objectStoreNames.contains(STORES.ndvi)) {
        const store = db.createObjectStore(STORES.ndvi, { keyPath: "id" });
        store.createIndex("timestamp", "timestamp");
      }
      if (!db.objectStoreNames.contains(STORES.smsLogs)) {
        const store = db.createObjectStore(STORES.smsLogs, { keyPath: "id" });
        store.createIndex("created_at", "created_at");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getAllFromStore<T>(storeName: string): Promise<T[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

async function putToStore<T>(storeName: string, data: T): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    store.put(data);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => reject(tx.error);
  });
}

async function putManyToStore<T>(storeName: string, items: T[]): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    items.forEach((item) => store.put(item));
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => reject(tx.error);
  });
}

// FIX: los stores usan dos formatos de timestamp distintos:
//   - sensors / ndvi -> campo "timestamp" numérico (epoch ms)
//   - sms_logs        -> campo "created_at" string ISO ("2026-01-01T00:00:00Z")
// clearOldRecords() comparaba/restaba estos valores directamente asumiendo
// que siempre eran números. Comparar un string ISO contra un número hace
// que JS intente convertir el string con Number(), lo cual da NaN para
// fechas ISO -> cualquier comparación con NaN es "false", así que
// cleanupSMSLogs() nunca borraba nada (y el sort tampoco ordenaba bien).
// toTimestamp() normaliza ambos casos a un epoch numérico comparable.
function toTimestamp(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const t = new Date(v).getTime();
    return Number.isNaN(t) ? 0 : t;
  }
  return 0;
}

async function clearOldRecords(storeName: string, indexName: string, maxAge: number, keepMin: number): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    const allReq = store.getAll();
    let deleted = 0;
    allReq.onsuccess = () => {
      const all = allReq.result;
      if (all.length <= keepMin) { db.close(); resolve(0); return; }
      const cutoff = Date.now() - maxAge;
      const sorted = all.sort((a: any, b: any) => toTimestamp(b[indexName]) - toTimestamp(a[indexName]));
      const toKeep = sorted.slice(0, keepMin);
      const keepIds = new Set(toKeep.map((r: any) => r.id));
      for (const record of all) {
        const ts = toTimestamp(record[indexName]);
        if (ts < cutoff && !keepIds.has(record.id)) {
          store.delete(record.id);
          deleted++;
        }
      }
    };
    tx.oncomplete = () => { db.close(); resolve(deleted); };
    tx.onerror = () => reject(tx.error);
  });
}

async function countRecords(storeName: string): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const req = tx.objectStore(storeName).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

export const willayDB = {
  // Sensors
  getSensorReadings: () => getAllFromStore<SensorReading>(STORES.sensors),
  addSensorReading: (data: SensorReading) => putToStore(STORES.sensors, data),
  addManySensorReadings: (data: SensorReading[]) => putManyToStore(STORES.sensors, data),
  getUnsyncedSensors: async (): Promise<SensorReading[]> => {
    const all = await getAllFromStore<SensorReading>(STORES.sensors);
    return all.filter((r) => !r.sincronizado);
  },
  markSynced: async (ids: string[]) => {
    const db = await openDB();
    const tx = db.transaction(STORES.sensors, "readwrite");
    const store = tx.objectStore(STORES.sensors);
    for (const id of ids) {
      const req = store.get(id);
      req.onsuccess = () => {
        if (req.result) {
          req.result.sincronizado = true;
          store.put(req.result);
        }
      };
    }
    return new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => reject(tx.error);
    });
  },

  // NDVI
  getNDVIData: () => getAllFromStore<NDVIRecord>(STORES.ndvi),
  addNDVIData: (data: NDVIRecord[]) => putManyToStore(STORES.ndvi, data),

  // SMS Logs
  getSMSLogs: () => getAllFromStore<SMSLogRecord>(STORES.smsLogs),
  addSMSLogs: (data: SMSLogRecord[]) => putManyToStore(STORES.smsLogs, data),

  // Cleanup
  cleanupSensors: (maxAgeDays = 180) =>
    clearOldRecords(STORES.sensors, "timestamp", maxAgeDays * 86400000, 1000),
  cleanupNDVI: (maxAgeDays = 180) =>
    clearOldRecords(STORES.ndvi, "timestamp", maxAgeDays * 86400000, 500),
  cleanupSMSLogs: (maxAgeDays = 180) =>
    clearOldRecords(STORES.smsLogs, "created_at", maxAgeDays * 86400000, 500),

  // Stats
  sensorCount: () => countRecords(STORES.sensors),
  ndviCount: () => countRecords(STORES.ndvi),
  smsLogCount: () => countRecords(STORES.smsLogs),
};
