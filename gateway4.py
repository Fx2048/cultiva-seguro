#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import serial
import time
import json
import threading
import queue
import requests
import re

# ───────────────── CONFIG ─────────────────
LORA_PORT = "/dev/serial0"
BAUD = 115200

SUPABASE_URL = "https://sjxaexssraavijbysqsd.supabase.co/functions/v1/sensor-data"

POST_ENABLED = True
RECONNECT_DELAY = 3

# Coordenadas (puedes luego hacerlas por device_id)
DEFAULT_LAT = -12.0464   # Lima
DEFAULT_LON = -77.0428

# ───────────────── COLA ─────────────────
rx_queue = queue.Queue(maxsize=100)

# ───────────────── ALERTA (solo opcional local) ─────────────────
def risk_level(t, h, s):
    if t is not None and t <= 2:
        return "helada"
    if s is not None and s <= 20:
        return "sequía"
    if t is not None and t <= 5 or s is not None and s <= 30:
        return "amarillo"
    return "verde"

# ───────────────── PARSER ROBUSTO ─────────────────
json_regex = re.compile(r"\{.*\}")

def parse_line(line):
    line = line.strip()

    try:
        if line.startswith("{"):
            return json.loads(line)
    except:
        pass

    try:
        match = json_regex.search(line)
        if match:
            return json.loads(match.group())
    except:
        pass

    return None

# ───────────────── NORMALIZACIÓN (FIX CLAVE) ─────────────────
def normalize(d):
    try:
        t = float(d.get("temperatura")) if d.get("temperatura") is not None else None
        h = float(d.get("humedad")) if d.get("humedad") is not None else None
        s = float(d.get("humedad_suelo")) if d.get("humedad_suelo") is not None else None

        return {
            "device_id": "heltec-rx",
            "lat": DEFAULT_LAT,
            "lon": DEFAULT_LON,
            "temperatura": t,
            "humedad": h,              # ⚠️ IMPORTANTE: coincide con backend
            "humedad_suelo": s,
            "source": "lora-gateway"
        }

    except Exception as e:
        print("normalize error:", e)
        return None

# ───────────────── SUPABASE PUSH ─────────────────
def push_supabase(payload):
    if not POST_ENABLED:
        return

    try:
        r = requests.post(SUPABASE_URL, json=payload, timeout=5)
        print("POST:", r.status_code, r.text[:100])
    except Exception as e:
        print("POST error:", e)

# ───────────────── LORA READER ─────────────────
def lora_reader():
    while True:
        try:
            print("🔌 Abriendo UART...")
            ser = serial.Serial(LORA_PORT, BAUD, timeout=2)
            print("✅ UART conectado")

            buffer = ""

            while True:
                chunk = ser.read(256).decode(errors="ignore")
                buffer += chunk

                if "\n" in buffer:
                    lines = buffer.split("\n")
                    buffer = lines[-1]

                    for line in lines[:-1]:
                        d = parse_line(line)
                        if d and not rx_queue.full():
                            rx_queue.put(d)

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

        print("📦 ENVIANDO:", norm)

        push_supabase(norm)

# ───────────────── WATCHDOG ─────────────────
def watchdog():
    while True:
        time.sleep(10)
        print("🟢 gateway alive")

# ───────────────── MAIN ─────────────────
def main():
    print("🚀 WILLAY GATEWAY (CORREGIDO)")

    threading.Thread(target=lora_reader, daemon=True).start()
    threading.Thread(target=processor, daemon=True).start()
    threading.Thread(target=watchdog, daemon=True).start()

    while True:
        time.sleep(1000)

if __name__ == "__main__":
    main()
