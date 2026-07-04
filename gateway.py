import serial

PORT = "/dev/ttyUSB0"
BAUD = 115200

print("================================")
print("   GATEWAY WILLAY")
print("================================")

ser = serial.Serial(PORT, BAUD, timeout=1)

while True:
    try:
        linea = ser.readline().decode("utf-8", errors="ignore").strip()

        if linea:
            print(linea)

    except KeyboardInterrupt:
        print("\nGateway detenido")
        break
