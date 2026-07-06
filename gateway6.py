#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import serial
import json
import pickle
import requests
import numpy as np

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

print("Cargando modelo...")

with open("willay_model.pkl","rb") as f:
    MODEL = pickle.load(f)

HELADA = MODEL["model_helada"]
SEQUIA = MODEL["model_sequia"]
FEATURES = MODEL["features"]

with open("report.json") as f:
    REPORT = json.load(f)

print("Modelo cargado correctamente")

# ======================================================
# HISTORIA (lags)
# ======================================================

temp_hist = deque(maxlen=3)
hum_hist = deque(maxlen=3)
prec_hist = deque(maxlen=3)

dias_secos = 0

# ======================================================
# FEATURES
# ======================================================

def make_features(temp, hum, suelo):

    global dias_secos

    precip = 0

    if suelo < 25:
        dias_secos += 1
    else:
        dias_secos = 0

    temp_hist.append(temp)
    hum_hist.append(hum)
    prec_hist.append(precip)

    if len(temp_hist) < 3:
        return None

    doy = datetime.now().timetuple().tm_yday

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

        "mes": datetime.now().month,

        "sin_doy": np.sin(2*np.pi*doy/365),

        "cos_doy": np.cos(2*np.pi*doy/365),
    }

    X = np.array([[values[f] for f in FEATURES]])

    return X

# ======================================================
# SERIAL
# ======================================================

ser = serial.Serial(PORT,BAUD,timeout=1)

print("Esperando datos...")

while True:

    linea = ser.readline().decode(errors="ignore").strip()

    if not linea.startswith("{"):
        continue

    try:

        dato = json.loads(linea)

        temp = dato["temperatura"]
        hum = dato["humedad"]
        suelo = dato["humedad_suelo"]

        X = make_features(temp,hum,suelo)

        if X is None:
            print("Esperando suficientes datos...")
            continue

        prob_helada = HELADA.predict_proba(X)[0][1]

        prob_sequia = SEQUIA.predict_proba(X)[0][1]

        print("--------------------------------")

        print("Temperatura:",temp)

        print("Humedad:",hum)

        print("Suelo:",suelo)

        print("Helada :",round(prob_helada*100,2),"%")

        print("Sequia :",round(prob_sequia*100,2),"%")

        payload = {

            "device_id":"heltec-rx",

            "lat":DEFAULT_LAT,

            "lon":DEFAULT_LON,

            "temperatura":temp,

            "humedad":hum,

            "humedad_suelo":suelo,

            "prob_helada":float(prob_helada),

            "prob_sequia":float(prob_sequia),

            "source":"gateway-ai"

        }

        r = requests.post(
            SUPABASE_URL,
            json=payload,
            timeout=5
        )

        print("Supabase:",r.status_code)

    except Exception as e:

        print(e)
