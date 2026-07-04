import serial

import json

import requests



PORT = "/dev/ttyUSB0"

BAUD = 115200



SUPABASE_URL = "https://sjxaexssraavijbysqsd.supabase.co/functions/v1/sensor-data"



SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqeGFleHNzcmFhdmlqYnlzcXNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0ODYyMjgsImV4cCI6MjA5MDA2MjIyOH0.Rvact_njjT4wNWnSBKuFI_5saHMiQrDnUUi9r9GMmKA" 



LAT = -12.0000

LON = -77.0000

DEVICE_ID = "WILLAY_NODE_001"



ser = serial.Serial(PORT, BAUD, timeout=1)



print("Gateway iniciado...")



while True:

    try:

        linea = ser.readline().decode("utf-8", errors="ignore").strip()



        if not linea.startswith("{"):

            continue



        datos = json.loads(linea)



        payload = {

            "lat": LAT,

            "lon": LON,

            "temperatura": datos["temperatura"],

            "humedad": datos["humedad"],

            "humedad_suelo": datos["humedad_suelo"],

            "device_id": DEVICE_ID,

            "source": "iot"

        }



        headers = {

            "apikey": SUPABASE_KEY,

            "Authorization": f"Bearer {SUPABASE_KEY}",

            "Content-Type": "application/json"

        }



        r = requests.post(

            SUPABASE_URL,

            json=payload,

            headers=headers,

            timeout=10

        )



        print("Enviado:", payload)

        print("Respuesta:", r.status_code, r.text)



    except Exception as e:

        print("Error:", e)
