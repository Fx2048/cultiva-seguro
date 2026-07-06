#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import serial
import json
import pickle
import requests
import numpy as np
import pandas as pd

from collections import deque
from datetime import datetime

# ======================================================
# CONFIGURACIÓN
# ======================================================

PORT = "/dev/ttyUSB0"
BAUD = 115200

SUPABASE_URL = "https://sjxaexssraavijbysqsd.supabase.co/functions/v1/sensor-data"

DEFAULT_LAT = -12.0464
DEFAULT_LON = -77.0428

# ======================================================
# CARGAR MODELO
# ======================================================

print("===================================")
print(" Cargando modelo WILLAY IA")
print("===================================")

with open("willay_model.pkl", "rb") as f:
    MODEL = pickle.load(f)

HELADA = MODEL["model_helada"]
SEQUIA = MODEL["model_sequia"]
FEATURES = MODEL["features"]

with open("report.json") as f:
    REPORT = json.load(f)

print("Modelo:", MODEL["kind"])
print("Número de variables:", len(FEATURES))
print("Modelo cargado correctamente\n")

# ======================================================
# HISTORIAL
# ======================================================

temp_hist = deque(maxlen=3)
hum_hist = deque(maxlen=3)
prec_hist = deque(maxlen=3)

dias_secos = 0

# ======================================================
# FEATURE ENGINEERING
# ======================================================

def make_features(temp, hum, suelo):

    global dias_secos

    precip = 0.0

    if suelo < 25:
        dias_secos += 1
    else:
        dias_secos = 0

    temp_hist.append(temp)
    hum_hist.append(hum)
    prec_hist.append(precip)

    if len(temp_hist) < 3:
        return None

    hoy = datetime.now()

    doy = hoy.timetuple().tm_yday

    values = {

        "t_min": temp,
        "t_mean": temp,

        "precip": precip,

        "humidity": hum,

        "t_min_lag1": temp_hist[-1],
        "t_min_lag2": temp_hist[-2],
        "t_min_lag3": temp_hist[-3],

        "t_mean_lag1": temp_hist[-1],
        "t_mean_lag2": temp_hist[-2],
        "t_mean_lag3": temp_hist[-3],

        "precip_lag1": prec_hist[-1],
        "precip_lag2": prec_hist[-2],
        "precip_lag3": prec_hist[-3],

        "humidity_lag1": hum_hist[-1],
        "humidity_lag2": hum_hist[-2],
        "humidity_lag3": hum_hist[-3],

        "t_min_roll3": np.mean(temp_hist),
        "t_mean_roll3": np.mean(temp_hist),

        "precip_roll3": np.mean(prec_hist),

        "humidity_roll3": np.mean(hum_hist),

        "dias_secos_acumulados": dias_secos,

        "mes": hoy.month,

        "sin_doy": np.sin(2*np.pi*doy/365),

        "cos_doy": np.cos(2*np.pi*doy/365),
    }

    return pd.DataFrame([values], columns=FEATURES)

# ======================================================
# SERIAL
# ======================================================

ser = serial.Serial(PORT, BAUD, timeout=1)

print("Esperando datos del receptor LoRa...\n")

while True:

    linea = ser.readline().decode(errors="ignore").strip()

    if not linea.startswith("{"):
        continue

    try:

        dato = json.loads(linea)

        temp = float(dato["temperatura"])
        hum = float(dato["humedad"])
        suelo = float(dato["humedad_suelo"])

        X = make_features(temp, hum, suelo)

        if X is None:
            print("Esperando suficientes muestras para construir los lags...")
            continue

        prob_helada = float(HELADA.predict_proba(X)[0][1])
        prob_sequia = float(SEQUIA.predict_proba(X)[0][1])

        if prob_helada >= 0.60:
            alerta = "HELADA"
        elif prob_sequia >= 0.60:
            alerta = "SEQUIA"
        else:
            alerta = "NORMAL"

        print("-------------------------------------------")
        print("Temperatura :", temp)
        print("Humedad     :", hum)
        print("Suelo       :", suelo)
        print("Helada      :", round(prob_helada*100,2), "%")
        print("Sequía      :", round(prob_sequia*100,2), "%")
        print("Alerta      :", alerta)

        payload = {

            "device_id": "heltec-rx",

            "lat": DEFAULT_LAT,

            "lon": DEFAULT_LON,

            "temperatura": temp,

            "humedad": hum,

            "humedad_suelo": suelo,

            "prob_helada": prob_helada,

            "prob_sequia": prob_sequia,

            "alerta": alerta,

            "modelo": MODEL["kind"],

            "source": "gateway-ai"
        }

        r = requests.post(
            SUPABASE_URL,
            json=payload,
            timeout=5
        )

        print("Supabase:", r.status_code)

        try:
            print(r.json())
        except Exception:
            print(r.text)

    except Exception as e:
        print("ERROR:", e)
