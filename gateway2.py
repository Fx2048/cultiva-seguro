#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import serial
import time
import threading
import queue
import requests
from datetime import datetime

# ───────── CONFIG ─────────
LORA_PORT = "/dev/serial0"
LORA_BAUD = 9600

SIM_PORT  = "/dev/ttyAMA1"
SIM_BAUD  = 9600

ENDPOINT_URL = "https://sjxaexssraavijbysqsd.supabase.co/functions/v1/sensor-data-2g"
POST_ENABLED = True

PHONES = ["+51983073205"]
SMS_COOLDOWN = 1800

UMBRAL_HELADA = 2.0
UMBRAL_FRIO   = 5.0
UMBRAL_SEQUIA = 20.0
UMBRAL_ALERTA = 30.0

# ───────── COLAS ─────────
lora_queue = queue.Queue()
alert_queue = queue.Queue()

# ───────── UTILIDADES ─────────
def safe_float(x):
    try:
        v = float(x)
        return None if v in (-99, -99.0) else v
    except:
        return None

_last_sms = {}

# ───────── PARSER ROBUSTO ─────────
def parse_line(line):
    line = line.strip()
    if not line.startswith("$WILLAY,"):
        return None

    try:
        body = line.split("*")[0].replace("$WILLAY,", "")
        p = body.split(",")

        if len(p) < 7:
            return None

        return {
            "id": p[0],
            "seq": int(p[1]),
            "T": safe_float(p[2]),
            "H": safe_float(p[3]),
            "S": safe_float(p[4]),
            "rssi": int(p[5]),
            "snr": int(float(p[6])),
            "ts": time.time()
        }
    except:
        return None

# ───────── RIESGO ─────────
def evaluar(d):
    t, s = d["T"], d["S"]

    if t is not None and t <= UMBRAL_HELADA:
        return "rojo", f"HELADA {t:.1f}C"
    if s is not None and s <= UMBRAL_SEQUIA:
        return "rojo", f"SEQUIA suelo {s:.0f}%"
    if (t is not None and t <= UMBRAL_FRIO) or (s is not None and s <= UMBRAL_ALERTA):
        return "amarillo", "Riesgo moderado"
    return "verde", ""

# ───────── LED (opcional simplificado) ─────────
try:
    import RPi.GPIO as GPIO
    GPIO.setmode(GPIO.BCM)

    LED_G, LED_Y, LED_R = 24, 25, 26
    for p in (LED_G, LED_Y, LED_R):
        GPIO.setup(p, GPIO.OUT)

    def set_led(level):
        GPIO.output(LED_G, level=="verde")
        GPIO.output(LED_Y, level=="amarillo")
        GPIO.output(LED_R, level=="rojo")

except:
    def set_led(level):
        pass

# ───────── THREAD 1: LORA ─────────
def lora_reader():
    ser = serial.Serial(LORA_PORT, LORA_BAUD, timeout=1)
    buffer = ""

    while True:
        try:
            chunk = ser.read(128).decode(errors="ignore")
            buffer += chunk

            while "\n" in buffer:
                line, buffer = buffer.split("\n", 1)
                d = parse_line(line)
                if d:
                    lora_queue.put(d)

        except Exception as e:
            print("LoRa error:", e)
            time.sleep(1)

# ───────── THREAD 2: PROCESSOR ─────────
def processor():
    while True:
        d = lora_queue.get()

        nivel, msg = evaluar(d)
        set_led(nivel)

        d["nivel"] = nivel
        d["msg"] = msg

        print(f"[{datetime.now().isoformat()}] {d}")

        # POST async
        if POST_ENABLED:
            try:
                requests.post(ENDPOINT_URL, json={
                    "d": d["id"],
                    "tx": "lora",
                    "r": [{
                        "t": int(d["ts"]),
                        "T": d["T"],
                        "H": d["H"],
                        "S": d["S"],
                        "rssi": d["rssi"],
                        "snr": d["snr"]
                    }]
                }, timeout=5)
            except:
                pass

        # ALERTA
        if nivel == "rojo" and msg:
            alert_queue.put(msg)

# ───────── THREAD 3: SMS ─────────
def sms_worker():
    try:
        sim = serial.Serial(SIM_PORT, SIM_BAUD, timeout=2)
    except:
        print("SIM800 no disponible")
        return

    def at(cmd, wait=1):
        sim.write((cmd + "\r\n").encode())
        time.sleep(wait)
        return sim.read_all().decode(errors="ignore")

    at("AT")
    at("ATE0")
    at("AT+CMGF=1")

    while True:
        msg = alert_queue.get()

        for phone in PHONES:
            now = time.time()
            if now - _last_sms.get(phone, 0) < SMS_COOLDOWN:
                continue

            try:
                sim.write(f'AT+CMGS="{phone}"\r'.encode())
                time.sleep(1)
                sim.write(msg[:160].encode())
                sim.write(bytes([26]))
                time.sleep(5)

                resp = sim.read_all().decode(errors="ignore")
                if "OK" in resp:
                    _last_sms[phone] = now
                    print("SMS enviado:", phone)

            except Exception as e:
                print("SMS error:", e)

# ───────── MAIN ─────────
def main():
    print("🚀 WILLAY Gateway iniciado")

    threading.Thread(target=lora_reader, daemon=True).start()
    threading.Thread(target=processor, daemon=True).start()
    threading.Thread(target=sms_worker, daemon=True).start()

    while True:
        time.sleep(10)

if __name__ == "__main__":
    main()
