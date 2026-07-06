#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
WILLAY GATEWAY · versión corregida
====================================
Corrige los 2 problemas críticos del code review:

  1) FALTABA HEADER DE AUTH: las Edge Functions de Supabase exigen (por
     defecto) el header 'apikey' y/o 'Authorization: Bearer <anon_key>'.
     Sin esto, cada POST fallaba con 401 y el gateway seguía como si nada.

  2) WATCHDOG NO VIGILABA NADA: antes solo imprimía "gateway alive" cada
     10s sin chequear si de verdad llegaban paquetes LoRa o si los hilos
     seguían vivos. Ahora el watchdog:
       - Vigila hace cuánto no llega un paquete LoRa válido.
       - Vigila hace cuánto no se logra un POST exitoso a Supabase.
       - Verifica que los hilos (lora_reader, processor) sigan vivos.
       - Si un hilo murió, lo reinicia automáticamente.

  Extra (resiliencia para campo con internet inestable):
  3) BUFFER LOCAL EN DISCO: si el POST a Supabase falla (sin internet,
     5xx, etc.), el payload se guarda en un archivo .jsonl en vez de
     perderse. Un hilo aparte reintenta enviar ese buffer cada cierto
     tiempo y va limpiando lo que ya se envió.
  4) Se agrega el campo 'timestamp' (UTC) que pide tu tabla, generado por
     el Pi en el momento de recibir el paquete.
  5) Lat/lon configurables por variable de entorno (para cuando tengas
     las coordenadas reales del nodo, sin tocar código).

CONFIGURACIÓN NECESARIA (variables de entorno, o edítalas abajo):
    export SUPABASE_ANON_KEY="tu-anon-key-aqui"
    export WILLAY_LAT="-15.8402"     # opcional, si no: usa DEFAULT_LAT
    export WILLAY_LON="-70.0219"     # opcional, si no: usa DEFAULT_LON
"""

import serial
import time
import json
import threading
import queue
import requests
import re
import os
from datetime import datetime, timezone

# ───────────────── CONFIG ─────────────────
LORA_PORT = "/dev/serial0"
BAUD = 115200

SUPABASE_URL = "https://sjxaexssraavijbysqsd.supabase.co/functions/v1/sensor-data"

# --- AUTH (FIX CRÍTICO #1) ---
# Consíguela en: Supabase Dashboard -> Settings -> API -> Project API keys -> anon/public
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "")
if not SUPABASE_ANON_KEY:
    print("⚠️  ADVERTENCIA: SUPABASE_ANON_KEY no está configurada. "
          "Los POST muy probablemente van a fallar con 401.")

POST_ENABLED = True
RECONNECT_DELAY = 3
HTTP_TIMEOUT = 8

# --- Coordenadas del nodo (placeholder hasta tener las reales) ---
DEFAULT_LAT = -15.8402   # placeholder Puno (ajustar cuando tengas GPS real)
DEFAULT_LON = -70.0219
NODE_LAT = float(os.environ.get("WILLAY_LAT", DEFAULT_LAT))
NODE_LON = float(os.environ.get("WILLAY_LON", DEFAULT_LON))

DEVICE_ID = os.environ.get("WILLAY_DEVICE_ID", "heltec-rx")

# --- Buffer local para reintentos ---
BUFFER_FILE = os.environ.get("WILLAY_BUFFER_FILE", "willay_buffer.jsonl")
RETRY_INTERVAL_S = 30       # cada cuánto se intenta vaciar el buffer
MAX_BUFFER_LINES = 20000    # tope de seguridad para no llenar el disco

# --- Umbrales del watchdog ---
MAX_SIN_PAQUETE_S = 180     # si no llega ningún paquete LoRa válido en 3 min -> alerta
MAX_SIN_PUSH_OK_S = 300     # si no hay push exitoso en 5 min (habiendo datos) -> alerta
WATCHDOG_INTERVAL_S = 15

# ───────────────── ESTADO COMPARTIDO ─────────────────
rx_queue = queue.Queue(maxsize=200)
buffer_lock = threading.Lock()

estado = {
    "last_rx_ts": None,       # último paquete LoRa válido recibido
    "last_push_ok_ts": None,  # último POST exitoso a Supabase
    "packets_recibidos": 0,
    "pushes_ok": 0,
    "pushes_fail": 0,
}

hilos = {}  # nombre -> threading.Thread, para que el watchdog pueda revisarlos/reiniciarlos


# ───────────────── ALERTA LOCAL (umbral simple) ─────────────────
def risk_level(t, h, s):
    if t is not None and t <= 2:
        return "helada"
    if s is not None and s <= 20:
        return "sequía"
    if (t is not None and t <= 5) or (s is not None and s <= 30):
        return "amarillo"
    return "verde"


# ───────────────── PARSER ROBUSTO ─────────────────
json_regex = re.compile(r"\{.*\}")

def parse_line(line):
    line = line.strip()
    if not line:
        return None
    try:
        if line.startswith("{"):
            return json.loads(line)
    except Exception:
        pass
    try:
        match = json_regex.search(line)
        if match:
            return json.loads(match.group())
    except Exception:
        pass
    return None


# ───────────────── NORMALIZACIÓN ─────────────────
def normalize(d):
    """Convierte el JSON recibido por LoRa al esquema exacto de la tabla:
    id (auto), lat, lon, temperatura, humedad, humedad_suelo, timestamp,
    device_id, source, created_at (auto)."""
    try:
        t = float(d.get("temperatura")) if d.get("temperatura") is not None else None
        h = float(d.get("humedad")) if d.get("humedad") is not None else None
        s = float(d.get("humedad_suelo")) if d.get("humedad_suelo") is not None else None

        return {
            "device_id": DEVICE_ID,
            "lat": NODE_LAT,
            "lon": NODE_LON,
            "temperatura": t,
            "humedad": h,
            "humedad_suelo": s,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "source": "lora-gateway",
        }
    except Exception as e:
        print("normalize error:", e)
        return None


# ───────────────── ENVÍO A SUPABASE ─────────────────
def _headers():
    h = {"Content-Type": "application/json"}
    if SUPABASE_ANON_KEY:
        # Mandamos ambos: la mayoría de setups de Supabase Edge Functions
        # requieren 'apikey', y si además está el JWT-verify activado,
        # también exige 'Authorization: Bearer <key>'.
        h["apikey"] = SUPABASE_ANON_KEY
        h["Authorization"] = f"Bearer {SUPABASE_ANON_KEY}"
    return h


def _intentar_post(payload) -> bool:
    """Devuelve True si el POST fue exitoso (2xx)."""
    try:
        r = requests.post(SUPABASE_URL, json=payload,
                           headers=_headers(), timeout=HTTP_TIMEOUT)
        ok = 200 <= r.status_code < 300
        if ok:
            print("✅ POST", r.status_code, r.text[:100])
        elif r.status_code == 401:
            print("🔒 POST 401 Unauthorized -> revisa SUPABASE_ANON_KEY "
                  "(¿está seteada? ¿es la correcta?)")
        else:
            print("⚠️  POST", r.status_code, r.text[:200])
        return ok
    except Exception as e:
        print("❌ POST error (sin conexión probablemente):", e)
        return False


def guardar_en_buffer(payload):
    with buffer_lock:
        try:
            with open(BUFFER_FILE, "a") as f:
                f.write(json.dumps(payload) + "\n")
        except Exception as e:
            print("❌ No pude escribir en buffer local:", e)


def push_supabase(payload):
    if not POST_ENABLED:
        return
    ok = _intentar_post(payload)
    if ok:
        estado["last_push_ok_ts"] = time.time()
        estado["pushes_ok"] += 1
    else:
        estado["pushes_fail"] += 1
        guardar_en_buffer(payload)
        print(f"💾 Payload guardado en {BUFFER_FILE} para reintentar luego")


# ───────────────── HILO: REINTENTO DE BUFFER ─────────────────
def buffer_retry_worker():
    """Cada RETRY_INTERVAL_S intenta reenviar lo que quedó pendiente en
    BUFFER_FILE, en orden. En cuanto un envío falla, se asume que seguimos
    sin internet y se detiene el ciclo (para no golpear Supabase con cada
    línea inútilmente); lo que ya se envió bien se quita del archivo, el
    resto (incluyendo lo no intentado) se conserva para el próximo ciclo."""
    while True:
        time.sleep(RETRY_INTERVAL_S)
        with buffer_lock:
            if not os.path.exists(BUFFER_FILE):
                continue
            try:
                with open(BUFFER_FILE, "r") as f:
                    lineas = [l.strip() for l in f if l.strip()]
            except Exception as e:
                print("❌ No pude leer buffer local:", e)
                continue

            if not lineas:
                continue

            # tope de seguridad: si el buffer creció demasiado, se descartan
            # las líneas más viejas (nos quedamos con las más recientes)
            if len(lineas) > MAX_BUFFER_LINES:
                print(f"⚠️  Buffer excedió {MAX_BUFFER_LINES} líneas, "
                      f"se descartan {len(lineas) - MAX_BUFFER_LINES} viejas")
                lineas = lineas[-MAX_BUFFER_LINES:]

            print(f"🔄 Reintentando {len(lineas)} payload(s) pendientes...")
            fallo_detectado = False
            pendientes = []
            for linea in lineas:
                if fallo_detectado:
                    pendientes.append(linea)
                    continue
                try:
                    payload = json.loads(linea)
                except Exception:
                    continue  # línea corrupta, se descarta permanentemente

                if _intentar_post(payload):
                    estado["last_push_ok_ts"] = time.time()
                    estado["pushes_ok"] += 1
                else:
                    pendientes.append(linea)
                    fallo_detectado = True  # probablemente sin internet, no seguir insistiendo ahora

            try:
                with open(BUFFER_FILE, "w") as f:
                    for l in pendientes:
                        f.write(l + "\n")
            except Exception as e:
                print("❌ No pude reescribir buffer local:", e)


# ───────────────── LORA READER ─────────────────
def lora_reader():
    MAX_BUFFER_CHARS = 4096  # tope de seguridad ante basura sin '\n'
    while True:
        try:
            print("🔌 Abriendo UART...")
            ser = serial.Serial(LORA_PORT, BAUD, timeout=2)
            print("✅ UART conectado")

            buffer = ""

            while True:
                chunk = ser.read(256).decode(errors="ignore")
                buffer += chunk

                if len(buffer) > MAX_BUFFER_CHARS:
                    # datos basura sin salto de línea: se descarta para no
                    # crecer sin control
                    print("⚠️  Buffer UART sin '\\n' excedió el límite, se limpia")
                    buffer = ""

                if "\n" in buffer:
                    lines = buffer.split("\n")
                    buffer = lines[-1]

                    for line in lines[:-1]:
                        d = parse_line(line)
                        if d:
                            estado["last_rx_ts"] = time.time()
                            estado["packets_recibidos"] += 1
                            if not rx_queue.full():
                                rx_queue.put(d)
                            else:
                                print("⚠️  rx_queue llena, se descarta un paquete")

        except Exception as e:
            print("❌ UART error:", e)
            time.sleep(RECONNECT_DELAY)


# ───────────────── PROCESSOR ─────────────────
def processor():
    while True:
        d = rx_queue.get()
        norm = normalize(d)
        if not norm:
            continue

        nivel = risk_level(norm["temperatura"], norm["humedad"], norm["humedad_suelo"])
        print(f"📦 ENVIANDO ({nivel}):", norm)

        push_supabase(norm)


# ───────────────── WATCHDOG (FIX CRÍTICO #2) ─────────────────
def _reiniciar_hilo(nombre, target):
    print(f"♻️  Reiniciando hilo '{nombre}' (murió inesperadamente)")
    t = threading.Thread(target=target, daemon=True, name=nombre)
    t.start()
    hilos[nombre] = t


def watchdog():
    while True:
        time.sleep(WATCHDOG_INTERVAL_S)
        ahora = time.time()

        # 1) ¿Siguen vivos los hilos críticos?
        for nombre, target in (("lora_reader", lora_reader), ("processor", processor)):
            t = hilos.get(nombre)
            if t is None or not t.is_alive():
                _reiniciar_hilo(nombre, target)

        # 2) ¿Hace cuánto no llega un paquete LoRa válido?
        if estado["last_rx_ts"] is None:
            print("🟡 watchdog: aún no se ha recibido ningún paquete LoRa")
        else:
            sin_paquete = ahora - estado["last_rx_ts"]
            if sin_paquete > MAX_SIN_PAQUETE_S:
                print(f"🔴 watchdog: sin paquetes LoRa hace {sin_paquete:.0f}s "
                      f"(umbral {MAX_SIN_PAQUETE_S}s) -> revisar nodo emisor / antena")

        # 3) ¿Hace cuánto no hay un push exitoso? (sólo alerta si hay datos que enviar)
        if estado["last_rx_ts"] is not None:
            if estado["last_push_ok_ts"] is None:
                print("🔴 watchdog: nunca se ha logrado un POST exitoso a Supabase")
            else:
                sin_push = ahora - estado["last_push_ok_ts"]
                if sin_push > MAX_SIN_PUSH_OK_S:
                    print(f"🔴 watchdog: sin POST exitoso hace {sin_push:.0f}s "
                          f"(umbral {MAX_SIN_PUSH_OK_S}s) -> revisar internet / SUPABASE_ANON_KEY")

        print(f"🟢 gateway alive | rx={estado['packets_recibidos']} "
              f"push_ok={estado['pushes_ok']} push_fail={estado['pushes_fail']} "
              f"buffer={'existe' if os.path.exists(BUFFER_FILE) else 'vacío'}")


# ───────────────── MAIN ─────────────────
def main():
    print("🚀 WILLAY GATEWAY (CORREGIDO v2)")
    print(f"   device_id={DEVICE_ID}  lat={NODE_LAT}  lon={NODE_LON}")
    print(f"   auth configurada: {'sí' if SUPABASE_ANON_KEY else 'NO ⚠️'}")

    for nombre, target in (("lora_reader", lora_reader),
                            ("processor", processor),
                            ("buffer_retry", buffer_retry_worker)):
        t = threading.Thread(target=target, daemon=True, name=nombre)
        t.start()
        hilos[nombre] = t

    watchdog()  # corre en el hilo principal (así el proceso no termina)


if __name__ == "__main__":
    main()
