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
import os
import pickle
import math
from datetime import datetime

# ─────────────────────────────────────────────────────────────────────
# CONFIGURACIÓN  (editar antes de desplegar en campo)
# ─────────────────────────────────────────────────────────────────────
DEVICE_ID        = "pi-001"
# UPCH — Sede San Martín (Tarapoto)
LAT, LON         = -6.4869, -76.3784
# Chip MULTIOPERADOR: el SIM se registra solo en la red disponible.
# Probamos primero APNs específicos; si fallan, cae al genérico "internet".
APN_CANDIDATES   = ["movistar.pe", "claro.pe", "entel.pe", "bitel.pe", "internet"]
APN              = APN_CANDIDATES[0]         # se ajusta solo en gprs_up()
APN_USER         = ""
APN_PASS         = ""

# Edge function pública (no necesita JWT)
SUPABASE_PROJECT = "sjxaexssraavijbysqsd"
ENDPOINT_URL     = f"https://{SUPABASE_PROJECT}.supabase.co/functions/v1/sensor-data-2g"

# Números destino (agricultores) — formato internacional E.164
PHONES_ALERTA    = ["+51983073205"]

# Umbrales del modelo local (estos son los "VALORES DE REFERENCIA"
# que pidió el profesor explícitamente)
UMBRAL_HELADA_C  = 2.0     # si T_predicha ≤ 2°C → enviar SMS
UMBRAL_SEQUIA_S  = 20.0    # si humedad_suelo ≤ 20% → enviar SMS

SERIAL_PORT      = "/dev/serial0"
BAUDRATE         = 9600
READ_INTERVAL_S  = 600     # 10 minutos
SMS_COOLDOWN_S   = 1800    # 30 minutos entre SMS al mismo número

# Modelo entrenado en disco (se genera con train_model())
MODEL_PATH       = "/home/pi/willay_model.pkl"
# Histórico local de lecturas (CSV simple) para reentrenar en campo
HIST_CSV         = "/home/pi/willay_hist.csv"
# Horizonte de predicción de helada (horas)
HORIZONTE_H      = 4

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
    """
    Abre el bearer GPRS (AT+SAPBR). Como el chip es MULTIOPERADOR, probamos
    varios APN hasta que uno levante IP.
    """
    global APN
    for apn in APN_CANDIDATES:
        print(f"🌐 Probando APN: {apn}")
        at("AT+SAPBR=0,1", 1)                 # cerrar bearer previo
        at('AT+SAPBR=3,1,"Contype","GPRS"', 0.5)
        at(f'AT+SAPBR=3,1,"APN","{apn}"', 0.5)
        at("AT+SAPBR=1,1", 4)
        resp = at("AT+SAPBR=2,1", 1)
        if "+SAPBR: 1,1" in resp and "0.0.0.0" not in resp:
            APN = apn
            print(f"✅ GPRS activo con APN={apn}")
            return True
    print("❌ Ningún APN levantó GPRS")
    return False


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
    Modelo EXPLICABLE local entrenado offline (regresión / XGBoost).
    Devuelve la temperatura predicha a HORIZONTE_H horas a partir de la
    lectura actual {T, H, S}. Si no hay modelo en disco, cae a T actual.
    """
    T = lectura.get("T"); H = lectura.get("H"); S = lectura.get("S")
    if T is None:
        return 99.0
    mdl = _load_model()
    if mdl is None:
        return T
    try:
        # features: [T, H, S, hora_dia, mes]
        now = datetime.now()
        x = [[T, H if H is not None else 60.0,
              S if S is not None else 30.0,
              now.hour, now.month]]
        kind = mdl.get("kind")
        if kind == "linear":
            # y = b0 + b1*T + b2*H + b3*S + b4*hora + b5*mes
            b = mdl["coef"]
            return float(b[0] + b[1]*x[0][0] + b[2]*x[0][1] +
                         b[3]*x[0][2] + b[4]*x[0][3] + b[5]*x[0][4])
        else:  # sklearn / xgboost
            return float(mdl["est"].predict(x)[0])
    except Exception as e:
        print(f"⚠️  Modelo falló ({e}); uso T actual")
        return T


# ─────────────────────────────────────────────────────────────────────
# ENTRENAMIENTO DEL MODELO  (lo que pidió el profesor)
#   - Regresión lineal multivariable  (baseline explicable)
#   - XGBoost si está instalado       (mejor precisión)
#   - Reporta el ERROR del modelo:    MAE, RMSE, R²   (train + test)
# ─────────────────────────────────────────────────────────────────────
def _load_model():
    if not os.path.exists(MODEL_PATH):
        return None
    with open(MODEL_PATH, "rb") as f:
        return pickle.load(f)


def _read_hist():
    """CSV: ts,T,H,S,T_future_4h"""
    X, y = [], []
    if not os.path.exists(HIST_CSV):
        return X, y
    with open(HIST_CSV) as f:
        for ln in f.readlines()[1:]:
            try:
                ts, T, H, S, Tf = ln.strip().split(",")
                d = datetime.fromisoformat(ts)
                X.append([float(T), float(H), float(S), d.hour, d.month])
                y.append(float(Tf))
            except Exception:
                continue
    return X, y


def _metrics(y_true, y_pred):
    n = len(y_true)
    err = [y_pred[i] - y_true[i] for i in range(n)]
    mae  = sum(abs(e) for e in err) / n
    rmse = math.sqrt(sum(e*e for e in err) / n)
    ybar = sum(y_true) / n
    ss_t = sum((y - ybar) ** 2 for y in y_true) or 1e-9
    ss_r = sum(e*e for e in err)
    r2   = 1 - ss_r / ss_t
    return mae, rmse, r2


def train_model(use_xgboost: bool = True) -> dict:
    """
    Entrena el modelo de predicción de helada a 4h y mide el ERROR.
    Pide regresión y/o XGBoost (cumple consigna del profesor).
    Uso:  sudo python3 willay_pi_sim800_alert.py --train
    """
    X, y = _read_hist()
    if len(y) < 30:
        raise RuntimeError(
            f"Insuficientes datos ({len(y)}). Recolecta ≥30 lecturas "
            f"horarias en {HIST_CSV} antes de entrenar.")

    # split 80/20
    cut = int(0.8 * len(y))
    Xtr, Xte = X[:cut], X[cut:]
    ytr, yte = y[:cut], y[cut:]

    model = None
    kind  = None

    if use_xgboost:
        try:
            from xgboost import XGBRegressor
            est = XGBRegressor(n_estimators=200, max_depth=4,
                               learning_rate=0.05, objective="reg:squarederror")
            est.fit(Xtr, ytr)
            model = {"kind": "xgboost", "est": est}
            kind = "xgboost"
        except ImportError:
            print("ℹ️  xgboost no instalado, uso sklearn LinearRegression")

    if model is None:
        try:
            from sklearn.linear_model import LinearRegression
            est = LinearRegression().fit(Xtr, ytr)
            model = {"kind": "sklearn_linear", "est": est}
            kind = "sklearn_linear"
        except ImportError:
            # regresión lineal a mano (mínimos cuadrados con numpy)
            import numpy as np
            A = np.c_[np.ones(len(Xtr)), np.array(Xtr)]
            coef, *_ = np.linalg.lstsq(A, np.array(ytr), rcond=None)
            model = {"kind": "linear", "coef": coef.tolist()}
            kind = "linear (numpy lstsq)"

    # Evaluar ERROR (train + test) — esto es lo que pidió el profesor
    def _pred(Xs):
        if model["kind"] == "linear":
            b = model["coef"]
            return [b[0]+b[1]*x[0]+b[2]*x[1]+b[3]*x[2]+b[4]*x[3]+b[5]*x[4]
                    for x in Xs]
        return list(model["est"].predict(Xs))

    mae_tr, rmse_tr, r2_tr = _metrics(ytr, _pred(Xtr))
    mae_te, rmse_te, r2_te = _metrics(yte, _pred(Xte))

    report = {
        "modelo": kind,
        "n_train": len(ytr), "n_test": len(yte),
        "train": {"MAE": mae_tr, "RMSE": rmse_tr, "R2": r2_tr},
        "test":  {"MAE": mae_te, "RMSE": rmse_te, "R2": r2_te},
    }
    model["report"] = report

    with open(MODEL_PATH, "wb") as f:
        pickle.dump(model, f)

    print("──────── ENTRENAMIENTO WILLAY ────────")
    print(json.dumps(report, indent=2))
    print(f"✅ Modelo guardado en {MODEL_PATH}")
    return report


def _append_hist(lectura: dict, t_future: float | None = None) -> None:
    """Guarda lectura horaria; t_future se rellena 4h después por otro job."""
    new = not os.path.exists(HIST_CSV)
    with open(HIST_CSV, "a") as f:
        if new:
            f.write("ts,T,H,S,T_future_4h\n")
        f.write(f"{datetime.now().isoformat(timespec='seconds')},"
                f"{lectura.get('T','')},{lectura.get('H','')},"
                f"{lectura.get('S','')},{t_future if t_future is not None else ''}\n")


# ─────────────────────────────────────────────────────────────────────
# LOOP PRINCIPAL — ORDEN ESTRICTO: SMS primero, POST después
# ─────────────────────────────────────────────────────────────────────
def main() -> None:
    if not sim800_init():
        print("❌ SIM800 no responde"); return

    while True:
        lectura = read_sensors()
        print(f"[{datetime.now().isoformat(timespec='seconds')}] lectura={lectura}")

        # Persistir lectura para reentrenar el modelo en campo
        if lectura.get("T") is not None:
            _append_hist(lectura)

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
    import sys
    if "--train" in sys.argv:
        # Modo entrenamiento: NO abre el SIM800.
        sim.close()
        train_model(use_xgboost="--no-xgb" not in sys.argv)
        raise SystemExit(0)
    try:
        main()
    except KeyboardInterrupt:
        print("\n⏹  Detenido por usuario")
    finally:
        sim.close()