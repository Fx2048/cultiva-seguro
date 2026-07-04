import serial

# Abrir el puerto serial
ser = serial.Serial('/dev/ttyUSB0', 9600, timeout=1)

print("Gateway iniciado...")
print("Esperando datos...\n")

while True:
    if ser.in_waiting:
        linea = ser.readline().decode('utf-8').strip()

        if linea:
            print(linea)
