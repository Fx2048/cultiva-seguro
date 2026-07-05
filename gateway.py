import serial
import json
import requests
import time

# ==========================================================
# CONFIGURACIÓN
# ==========================================================

PORT = "/dev/ttyUSB0"
BAUD = 115200

# URL de la tabla sensor_readings
SUPABASE_URL = "https://zcuafjpgczvdhvjrbxtw.supabase.co/rest/v1/sensor_readings"

# API Key (anon/publishable)
SUPABASE_KEY = "sb_publishable_AFZSOwMI9vDl8gW3J8ArHA_aBAqT3Cp"

# Ubicación del nodo
LAT = -12.0000
LON = -77.0000

DEVICE_ID = "WILLAY_NODE_001"

# ==========================================================
# INICIALIZACIÓN
# ==========================================================

try:
    ser = serial.Serial(PORT, BAUD, timeout=1)
    print("Puerto serial abierto correctamente.")
except Exception as e:
    print("No se pudo abrir el puerto serial:", e)
    exit()

headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}

print("=" * 60)
print("        GATEWAY WILLAY")
print("=" * 60)
print("Esperando datos LoRa...\n")

# ==========================================================
# BUCLE PRINCIPAL
# ==========================================================

while True:

    try:

        linea = ser.readline().decode(
            "utf-8",
            errors="ignore"
        ).strip()

        if linea == "":
            continue

        print("\n------------------------------------------")
        print("RECIBIDO:")
        print(linea)

        # Solo procesar JSON
        if not linea.startswith("{"):
            print("Ignorado (no es JSON)")
            continue

        # Reemplazar nan por null
        linea = linea.replace(":nan", ":null")

        try:
            datos = json.loads(linea)
        except Exception as e:
            print("Error al interpretar JSON:")
            print(e)
            continue

        payload = {

            "device_id": DEVICE_ID,

            "temperatura": datos.get("temperatura"),

            "humedad": datos.get("humedad"),

            "humedad_suelo": datos.get("humedad_suelo"),

            "lat": LAT,

            "lon": LON,

            "source": "iot"

        }

        print("\nPayload:")
        print(json.dumps(payload, indent=4))

        print("\nEnviando datos a Supabase...")

        respuesta = requests.post(
            SUPABASE_URL,
            headers=headers,
            json=payload,
            timeout=10
        )

        print("\n====================================")
        print("Código HTTP:", respuesta.status_code)

        if respuesta.text:
            print("Respuesta:")
            print(respuesta.text)

        if respuesta.status_code in (200, 201):

            print("\n✅ Datos enviados correctamente.")

        else:

            print("\n❌ Error al insertar datos.")

        print("====================================")

    except KeyboardInterrupt:

        print("\n\nGateway detenido.")
        break

    except requests.exceptions.RequestException as e:

        print("\nError de conexión con Supabase:")
        print(e)

        time.sleep(3)

    except Exception as e:

        print("\nError inesperado:")
        print(e)

        time.sleep(2)
