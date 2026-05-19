#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
WILLAY · Raspberry Pi + SIM800L
================================
Script ÚNICO con DOS funciones en ORDEN ESTRICTO DE PRIORIDAD:

  (1) send_sms_alert_at()   → PRIORITARIO. Envía SMS por AT (AT+CMGF=1, AT+CMGS).
                              Si la temperatura cae bajo el umbral, AVISA AL
                              AGRICULTOR INMEDIATAMENTE (la vida del cultivo
                              depende de esto).

  (2) post_reading_http_at() → DESPUÉS. Publica la lectura al backend (edge
                              function `sensor-data-2g`) por HTTPS sobre GPRS/2G
                              usando AT+SAPBR, AT+HTTPINIT, AT+HTTPPARA,
                              AT+HTTPDATA, AT+HTTPACTION=1.

El loop principal:
  1. Lee sensores desde el puerto serial (ESP32/Arduino) o DHT22 local.
  2. Pasa los datos al modelo local (regresión / XGBoost embebido).
  3. Si predicción < UMBRAL_HELADA → (1) SMS YA.
  4. Luego, SIEMPRE → (2) POST al backend.

Requisitos:
    pip3 install pyserial adafruit-circuitpython-dht adafruit-blinka

Cableado SIM800L → Raspberry Pi:
    SIM800 TX  → Pi RX  (GPIO15)
    SIM800 RX  → Pi TX  (GPIO14) — usar divisor 5V→3V3
    SIM800 GND → Pi GND
    SIM800 VCC → 4.0V externos (NO desde la Pi, pico ~2 A)
"""

import json
import time
import serial
from datetime import datetime

# ─────────────────────────────────────────────────────────────────────
# CONFIGURACIÓN  (editar antes de desplegar en campo)
# ─────────────────────────────────────────────────────────────────────
DEVICE_ID        = "pi-001"
LAT, LON         = -13.5320, -71.9675       # Cusco aprox.
APN              = "movistar.pe"             # o "claro.pe" / "entel.pe"
APN_USER         = ""
APN_PASS         = ""

# Edge function pública (no necesita JWT)
SUPABASE_PROJECT = "sjxaexssraavijbysqsd"
ENDPOINT_URL     = f"https://{SUPABASE_PROJECT}.supabase.co/functions/v1/sensor-data-2g"

# Números destino (agricultores) — formato internacional E.164
PHONES_ALERTA    = ["+51999999999"]

# Umbrales del modelo local (estos son los "VALORES DE REFERENCIA"
# que pidió el profesor explícitamente)
UMBRAL_HELADA_C  = 2.0     # si T_predicha ≤ 2°C → enviar SMS
UMBRAL_SEQUIA_S  = 20.0    # si humedad_suelo ≤ 20% → enviar SMS

SERIAL_PORT      = "/dev/serial0"
BAUDRATE         = 9600
READ_INTERVAL_S  = 600     # 10 minutos
SMS_COOLDOWN_S   = 1800    # 30 minutos entre SMS al mismo número

# ─────────────────────────────────────────────────────────────────────
# CAPA AT (SIM800L)
# ─────────────────────────────────────────────────────────────────────
sim = serial.Serial(SERIAL_PORT, BAUDRATE, timeout=2)
_last_sms_at = 0.0


def at(cmd: str, wait: float = 1.0, expect: str = "OK") -> str:
    """Envía un comando AT y devuelve la respuesta cruda."""
    sim.reset_input_buffer()
    sim.write((cmd + "\r\n").encode())
    time.sleep(wait)
    resp = sim.read_all().decode(errors="ignore")
    print(f">> {cmd}\n<< {resp.strip()}")
    return resp


def sim800_init() -> bool:
    """Comprueba que el módem responde y tiene red."""
    if "OK" not in at("AT"):                 return False
    at("ATE0")                                # eco off
    at("AT+CMEE=2")                           # errores legibles
    if "+CREG: 0,1" not in at("AT+CREG?") and "+CREG: 0,5" not in at("AT+CREG?"):
        print("⚠️  Sin registro en red GSM")
    return True


# ─────────────────────────────────────────────────────────────────────
# (1) FUNCIÓN PRIORITARIA — SMS VÍA AT
# ─────────────────────────────────────────────────────────────────────
def send_sms_alert_at(phone: str, mensaje: str) -> bool:
    """
    Envía un SMS por AT. PRIORIDAD MÁXIMA: la vida del cultivo depende
    de que el agricultor reciba este aviso antes de que baje la temperatura.
    """
    global _last_sms_at
    if time.time() - _last_sms_at < SMS_COOLDOWN_S:
        print("⏱  SMS en cooldown, omitido")
        return False

    at("AT+CMGF=1", 0.5)                      # modo texto
    at('AT+CSCS="GSM"', 0.5)
    sim.write(f'AT+CMGS="{phone}"\r'.encode())
    time.sleep(0.5)
    sim.write(mensaje.encode())
    sim.write(bytes([0x1A]))                  # Ctrl+Z = enviar
    time.sleep(8)                             # SIM800 puede tardar varios s
    resp = sim.read_all().decode(errors="ignore")
    ok = "+CMGS" in resp or "OK" in resp
    print(f"📨 SMS → {phone} | {'OK' if ok else 'FAIL'}\n{resp}")
    if ok:
        _last_sms_at = time.time()
    return ok


# ─────────────────────────────────────────────────────────────────────
# (2) FUNCIÓN SECUNDARIA — HTTP POST VÍA AT (GPRS/2G)
# ─────────────────────────────────────────────────────────────────────
def gprs_up() -> bool:
    """Abre el bearer GPRS (AT+SAPBR)."""
    at('AT+SAPBR=3,1,"Contype","GPRS"', 0.5)
    at(f'AT+SAPBR=3,1,"APN","{APN}"', 0.5)
    if APN_USER:
        at(f'AT+SAPBR=3,1,"USER","{APN_USER}"', 0.5)
        at(f'AT+SAPBR=3,1,"PWD","{APN_PASS}"', 0.5)
    at("AT+SAPBR=1,1", 3)                     # activar bearer
    resp = at("AT+SAPBR=2,1", 1)              # consultar IP
    return "+SAPBR: 1,1" in resp


def gprs_down() -> None:
    at("AT+SAPBR=0,1", 1)


def post_reading_http_at(payload: dict) -> bool:
    """
    POST JSON a la edge function `sensor-data-2g` por HTTPS sobre 2G usando
    el cliente HTTP embebido del SIM800.
    """
    if not gprs_up():
        print("❌ No se pudo levantar GPRS")
        return False

    try:
        at("AT+HTTPTERM", 0.3)                # por si quedó abierto
        at("AT+HTTPINIT", 0.5)
        at('AT+HTTPPARA="CID",1', 0.3)
        at(f'AT+HTTPPARA="URL","{ENDPOINT_URL}"', 0.3)
        at('AT+HTTPPARA="CONTENT","application/json"', 0.3)
        at("AT+HTTPSSL=1", 0.3)               # HTTPS

        body = json.dumps(payload, separators=(",", ":"))
        sim.write(f'AT+HTTPDATA={len(body)},10000\r\n'.encode())
        time.sleep(0.5)
        sim.read_all()                        # "DOWNLOAD"
        sim.write(body.encode())
        time.sleep(2)

        resp = at("AT+HTTPACTION=1", 8)       # 1 = POST
        # Respuesta esperada: +HTTPACTION: 1,200,<len>
        ok = "200" in resp or "201" in resp
        at("AT+HTTPREAD", 2)                  # opcional: leer cuerpo
        at("AT+HTTPTERM", 0.3)
        return ok
    finally:
        gprs_down()


# ─────────────────────────────────────────────────────────────────────
# LECTURA DE SENSORES (placeholder — adaptar a tu hardware)
# ─────────────────────────────────────────────────────────────────────
def read_sensors() -> dict:
    """
    Devuelve {T, H, S} con temperatura (°C), humedad aire (%) y humedad
    suelo (%). Aquí se asume que llegan por serial desde un ESP32 nodo
    en formato JSON una línea, ej: {"T":3.1,"H":78,"S":42}
    """
    try:
        line = sim.readline().decode(errors="ignore").strip()
        if line.startswith("{"):
            return json.loads(line)
    except Exception:
        pass
    # fallback dummy para pruebas en banco
    return {"T": None, "H": None, "S": None}


# ─────────────────────────────────────────────────────────────────────
# MODELO LOCAL (placeholder explicable — regresión simple)
# ─────────────────────────────────────────────────────────────────────
def predecir_helada(lectura: dict) -> float:
    """
    Modelo EXPLICABLE local. Aquí va el XGBoost/regresión entrenado.
    Por ahora devuelve la propia T como predicción a 4h para validar el flujo.
    """
    return lectura.get("T") if lectura.get("T") is not None else 99.0


# ─────────────────────────────────────────────────────────────────────
# LOOP PRINCIPAL — ORDEN ESTRICTO: SMS primero, POST después
# ─────────────────────────────────────────────────────────────────────
def main() -> None:
    if not sim800_init():
        print("❌ SIM800 no responde"); return

    while True:
        lectura = read_sensors()
        print(f"[{datetime.now().isoformat(timespec='seconds')}] lectura={lectura}")

        t_pred = predecir_helada(lectura)
        s_act  = lectura.get("S")

        # ── (1) PRIORIDAD: SMS si hay riesgo ───────────────────────
        if t_pred is not None and t_pred <= UMBRAL_HELADA_C:
            msg = (f"WILLAY: HELADA prevista {t_pred:.1f}C. "
                   f"Riega y cubre cultivos YA. willay.app")[:160]
            for tel in PHONES_ALERTA:
                send_sms_alert_at(tel, msg)

        elif s_act is not None and s_act <= UMBRAL_SEQUIA_S:
            msg = (f"WILLAY: SEQUIA suelo {s_act:.0f}%. "
                   f"Riega hoy. willay.app")[:160]
            for tel in PHONES_ALERTA:
                send_sms_alert_at(tel, msg)

        # ── (2) DESPUÉS: publicar al backend ───────────────────────
        payload = {
            "d": DEVICE_ID,
            "lat": LAT, "lon": LON,
            "tx": "2g",
            "r": [{
                "t": int(time.time()),
                "T": lectura.get("T"),
                "H": lectura.get("H"),
                "S": lectura.get("S"),
            }],
        }
        post_reading_http_at(payload)

        time.sleep(READ_INTERVAL_S)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n⏹  Detenido por usuario")
    finally:
        sim.close()