#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
WILLAY · Gateway en Raspberry Pi 3 B+
======================================
- Lee tramas LoRa reenviadas por el Heltec RECEPTOR vía UART (/dev/serial0)
    formato:  $WILLAY,<id>,<seq>,<T>,<H>,<S>,<rssi>,<snr>*
- Decide nivel de riesgo (Verde / Amarillo / Rojo) según umbrales.
- Prende LEDs (GPIO24=Verde, GPIO25=Amarillo, GPIO26=Rojo) con resistencia 1k.
- Si nivel = Rojo (helada o sequía severa) envía SMS por SIM800L (AT).
- Resetea SIM800L con GPIO17 si no responde.
- POSTea cada lectura al backend (edge function `sensor-data-2g`) opcional.

IMPORTANTE: la Pi sólo tiene UN UART hardware (/dev/serial0). Aquí se usa
para HABLAR con el Heltec receptor (que ya recibe LoRa). El SIM800L se
conecta a un segundo UART por software vía pigpio o se cablea al Heltec
(pines 21/20 según el prompt), y el Heltec hace el puente. En este script
asumimos que el SIM800L está cableado directo a la Pi en /dev/ttyAMA1
(activar overlay miniuart-bt o uart1 en /boot/config.txt). Si no, basta
con apuntar SIM_PORT a /dev/serial0 y desconectar el Heltec mientras se
manda SMS.

Instalación en la Pi:
    sudo apt update
    sudo apt install -y python3-pip python3-serial python3-rpi.gpio
    sudo pip3 install requests
    sudo raspi-config   # → Interface → Serial: login NO, hardware SI
    # Edita /boot/config.txt y añade:  enable_uart=1
    # Reinicia.

Servicio systemd: usar scripts/willay-pi.service (ya provisto).
"""

import json
import time
import os
import serial
import requests
from datetime import datetime

try:
    import RPi.GPIO as GPIO
    HAS_GPIO = True
except Exception:
    HAS_GPIO = False
    print("⚠️ RPi.GPIO no disponible (modo simulación)")

# ───────── Configuración ─────────
LORA_PORT   = "/dev/serial0"    # UART desde el Heltec receptor
LORA_BAUD   = 9600
SIM_PORT    = "/dev/ttyAMA1"    # SIM800L (cambia si va en /dev/serial0)
SIM_BAUD    = 9600

PIN_LED_VERDE   = 24
PIN_LED_AMARILLO= 25
PIN_LED_ROJO    = 26
PIN_SIM_RST     = 17

UMBRAL_HELADA_C = 2.0
UMBRAL_FRIO_C   = 5.0
UMBRAL_SEQUIA_S = 20.0
UMBRAL_ALERTA_S = 30.0
SMS_COOLDOWN_S  = 1800           # 30 min entre SMS al mismo nº

PHONES_ALERTA = ["+51983073205"]

SUPABASE_PROJECT = "sjxaexssraavijbysqsd"
ENDPOINT_URL = f"https://{SUPABASE_PROJECT}.supabase.co/functions/v1/sensor-data-2g"
POST_ENABLED = True              # pon False si la Pi no tiene Internet

# ───────── GPIO ─────────
def gpio_setup():
    if not HAS_GPIO: return
    GPIO.setmode(GPIO.BCM)
    GPIO.setwarnings(False)
    for pin in (PIN_LED_VERDE, PIN_LED_AMARILLO, PIN_LED_ROJO, PIN_SIM_RST):
        GPIO.setup(pin, GPIO.OUT, initial=GPIO.LOW)
    GPIO.output(PIN_SIM_RST, GPIO.HIGH)

def set_leds(verde=False, amarillo=False, rojo=False):
    if not HAS_GPIO: return
    GPIO.output(PIN_LED_VERDE,    GPIO.HIGH if verde    else GPIO.LOW)
    GPIO.output(PIN_LED_AMARILLO, GPIO.HIGH if amarillo else GPIO.LOW)
    GPIO.output(PIN_LED_ROJO,     GPIO.HIGH if rojo     else GPIO.LOW)

def reset_sim800():
    if not HAS_GPIO: return
    print("🔄 Reset SIM800L")
    GPIO.output(PIN_SIM_RST, GPIO.LOW)
    time.sleep(0.5)
    GPIO.output(PIN_SIM_RST, GPIO.HIGH)
    time.sleep(5)

# ───────── SIM800L (AT) ─────────
_last_sms = {}

def open_sim():
    try:
        return serial.Serial(SIM_PORT, SIM_BAUD, timeout=2)
    except Exception as e:
        print(f"⚠️ SIM800 no abre {SIM_PORT}: {e}")
        return None

def at(sim, cmd, wait=1.0):
    sim.reset_input_buffer()
    sim.write((cmd + "\r\n").encode())
    time.sleep(wait)
    r = sim.read_all().decode(errors="ignore")
    print(f">> {cmd}\n<< {r.strip()}")
    return r

def sim_init(sim):
    if sim is None: return False
    if "OK" not in at(sim, "AT", 0.5):
        reset_sim800()
        if "OK" not in at(sim, "AT", 1.0): return False
    at(sim, "ATE0", 0.3)
    at(sim, "AT+CMGF=1", 0.3)
    at(sim, 'AT+CSCS="GSM"', 0.3)
    return True

def enviar_sms(sim, phone, mensaje):
    now = time.time()
    if now - _last_sms.get(phone, 0) < SMS_COOLDOWN_S:
        print(f"⏱ SMS a {phone} en cooldown"); return False
    if sim is None or not sim_init(sim): return False
    at(sim, "AT+CMGF=1", 0.3)
    sim.write(f'AT+CMGS="{phone}"\r'.encode()); time.sleep(0.5)
    sim.write(mensaje.encode()); sim.write(bytes([0x1A]))
    time.sleep(8)
    r = sim.read_all().decode(errors="ignore")
    ok = "+CMGS" in r or "OK" in r
    print(f"📨 SMS {phone}: {'OK' if ok else 'FAIL'}")
    if ok: _last_sms[phone] = now
    return ok

# ───────── Lógica de riesgo ─────────
def evaluar(t, h, s):
    """Devuelve (nivel, mensaje) — nivel ∈ {'verde','amarillo','rojo'}."""
    if t is not None and t <= UMBRAL_HELADA_C:
        return "rojo", f"WILLAY: HELADA {t:.1f}C. Cubre y riega cultivos YA."
    if s is not None and s <= UMBRAL_SEQUIA_S:
        return "rojo", f"WILLAY: SEQUIA suelo {s:.0f}%. Riega hoy."
    if (t is not None and t <= UMBRAL_FRIO_C) or \
       (s is not None and s <= UMBRAL_ALERTA_S):
        return "amarillo", "WILLAY: condiciones de riesgo moderado."
    return "verde", ""

# ───────── Parseo trama ─────────
def parse_line(line):
    """ $WILLAY,EMI-001,123,4.1,78,42,-95,8* """
    line = line.strip()
    if not line.startswith("$WILLAY,"): return None
    body = line[len("$WILLAY,"):].split("*")[0]
    p = body.split(",")
    if len(p) < 7: return None
    try:
        return {
            "id":  p[0],
            "seq": int(p[1]),
            "T":   float(p[2]) if p[2] not in ("","nan","-99","-99.0") else None,
            "H":   float(p[3]) if p[3] not in ("","nan","-99","-99.0") else None,
            "S":   int(float(p[4])) if p[4] != "" else None,
            "rssi":int(p[5]),
            "snr": int(float(p[6])),
        }
    except Exception as e:
        print(f"parse error: {e} | {line}"); return None

# ───────── POST backend ─────────
def publicar(d):
    if not POST_ENABLED: return
    try:
        payload = {
            "d": d["id"], "tx": "lora+wifi",
            "r": [{"t": int(time.time()), "T": d["T"], "H": d["H"], "S": d["S"],
                    "rssi": d["rssi"], "snr": d["snr"]}],
        }
        r = requests.post(ENDPOINT_URL, json=payload, timeout=10)
        print(f"POST {r.status_code}")
    except Exception as e:
        print(f"POST falló: {e}")

# ───────── MAIN ─────────
def main():
    gpio_setup()
    set_leds(verde=True)
    try:
        lora = serial.Serial(LORA_PORT, LORA_BAUD, timeout=2)
    except Exception as e:
        print(f"❌ No puedo abrir {LORA_PORT}: {e}"); return
    sim = open_sim()
    sim_init(sim)

    print(f"✅ Gateway WILLAY escuchando en {LORA_PORT}")
    buf = ""
    while True:
        try:
            chunk = lora.read(128).decode(errors="ignore")
            if chunk:
                buf += chunk
                while "\n" in buf:
                    line, buf = buf.split("\n", 1)
                    d = parse_line(line)
                    if not d: continue
                    print(f"[{datetime.now().strftime('%H:%M:%S')}] {d}")
                    nivel, msg = evaluar(d["T"], d["H"], d["S"])
                    set_leds(verde=(nivel=="verde"),
                             amarillo=(nivel=="amarillo"),
                             rojo=(nivel=="rojo"))
                    if nivel == "rojo" and msg:
                        for tel in PHONES_ALERTA:
                            enviar_sms(sim, tel, msg[:160])
                    publicar(d)
            else:
                time.sleep(0.2)
        except KeyboardInterrupt:
            print("\n⏹ Detenido"); break
        except Exception as e:
            print(f"loop error: {e}"); time.sleep(1)

    set_leds(False, False, False)
    if HAS_GPIO: GPIO.cleanup()

if __name__ == "__main__":
    main()