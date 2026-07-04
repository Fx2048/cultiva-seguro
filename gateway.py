import serial
import json
import requests

# ============================
# CONFIGURACIÓN
# ============================

PORT = "/dev/ttyUSB0"
BAUD = 115200

SUPABASE_URL = "https://sjxaexssraavijbysqsd.supabase.co/functions/v1/sensor-data"

SUPABASE_KEY = "TU_ANON_KEY_AQUI"

LAT = -12.0000
LON = -77.0000
DEVICE_ID = "WILLAY_NODE_001"

# ============================

ser = serial.Serial(PORT, BAUD, timeout=1)

print("================================")
print(" GATEWAY WILLAY")
print("================================")

headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json"
}

while True:

    try:

        linea = ser.readline().decode("utf-8", errors="ignore").strip()

        if not linea:
            continue

        print("RECIBIDO:", linea)

        # Solo procesamos JSON
        if not linea.startswith("{"):
            continue

        # Convertimos nan -> null
        linea = linea.replace(":nan", ":null")

        try:
            datos = json.loads(linea)
        except Exception as e:
            print("JSON inválido:", e)
            continue

        payload = {

            "lat": LAT,
            "lon": LON,

            "temperatura": datos.get("temperatura"),
            "humedad": datos.get("humedad"),
            "humedad_suelo": datos.get("humedad_suelo"),

            "device_id": DEVICE_ID,
            "source": "iot"

        }

        print("Enviando a Supabase...")
        print(payload)

        respuesta = requests.post(
            SUPABASE_URL,
            json=payload,
            headers=headers,
            timeout=10
        )

        print("Código:", respuesta.status_code)
        print("Respuesta:", respuesta.text)

    except KeyboardInterrupt:
        print("\nGateway detenido.")
        break

    except Exception as e:
        print("ERROR:", e)
