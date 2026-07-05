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

# ───────────────── COLAS ─────────────────
rx_queue = queue.Queue(maxsize=100)

# ───────────────── ALERTA ─────────────────
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

    # 1. Intentar JSON directo
    try:
        if line.startswith("{"):
            return json.loads(line)
    except:
        pass

    # 2. Extraer JSON embebido en texto
    try:
        match = json_regex.search(line)
        if match:
            return json.loads(match.group())
    except:
        pass

    # 3. Parseo fallback tipo serial humano
    try:
        if "Temperatura" in line:
            # no confiamos en esto mucho, pero fallback
            return None
    except:
        return None

    return None

# ───────────────── NORMALIZACIÓN ─────────────────
def normalize(d):
    try:
        t = float(d.get("temperatura")) if d.get("temperatura") is not None else None
        h = float(d.get("humedad")) if d.get("humedad") is not None else None
        s = float(d.get("humedad_suelo")) if d.get("humedad_suelo") is not None else None

        alert = risk_level(t, h, s)

        return {
            "device_id": "heltec-rx",
            "timestamp": int(time.time() * 1000),
            "temperatura": t,
            "humedad_aire": h,
            "humedad_suelo": s,
            "alerta": alert
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
        print("POST:", r.status_code)
    except Exception as e:
        print("POST error:", e)

# ───────────────── LORA READER (THREAD) ─────────────────
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
                        if d:
                            if not rx_queue.full():
                                rx_queue.put(d)

        except Exception as e:
            print("❌ UART error:", e)
            time.sleep(RECONNECT_DELAY)

# ───────────────── PROCESSOR (THREAD) ─────────────────
def processor():
    while True:
        d = rx_queue.get()

        norm = normalize(d)
        if not norm:
            continue

        print("📦", norm)

        push_supabase(norm)

# ───────────────── WATCHDOG ─────────────────
def watchdog():
    while True:
        time.sleep(10)
        print("🟢 gateway alive")

# ───────────────── MAIN ─────────────────
def main():
    print("🚀 WILLAY GATEWAY vFINAL")

    threading.Thread(target=lora_reader, daemon=True).start()
    threading.Thread(target=processor, daemon=True).start()
    threading.Thread(target=watchdog, daemon=True).start()

    while True:
        time.sleep(1000)

if __name__ == "__main__":
    main()
