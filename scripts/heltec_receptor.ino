#include <Arduino.h>
#include "LoRaWan_APP.h"
#include "HT_SSD1306Wire.h"

//======================================================
// CONFIGURACIÓN LORA
//======================================================

#define RF_FREQUENCY              915000000

#define LORA_BANDWIDTH            0
#define LORA_SPREADING_FACTOR     9
#define LORA_CODINGRATE           1
#define LORA_PREAMBLE_LENGTH      8
#define LORA_IQ_INVERSION_ON      false

#define BUFFER_SIZE 128

char rxpacket[BUFFER_SIZE];

static RadioEvents_t RadioEvents;

//======================================================
// OLED
//======================================================

SSD1306Wire oled(
    0x3c,
    500000,
    SDA_OLED,
    SCL_OLED,
    GEOMETRY_128_64,
    RST_OLED
);

//======================================================
// RECEPCIÓN LORA
//======================================================

void OnRxDone(uint8_t *payload,
              uint16_t size,
              int16_t rssi,
              int8_t snr)
{
    memcpy(rxpacket, payload, size);
    rxpacket[size] = '\0';

    // Variables para almacenar los datos
    char id[20];
    unsigned long secuencia;
    float temperatura;
    float humedadAire;
    int humedadSuelo;
    char estado[20];

    int datos = sscanf(rxpacket,
                       "%19[^;];%lu;%f;%f;%d;%19s",
                       id,
                       &secuencia,
                       &temperatura,
                       &humedadAire,
                       &humedadSuelo,
                       estado);

    if (datos == 6)
    {
        //=============================
        // Monitor Serie
        //=============================

        Serial.println("--------------------------------");

        Serial.print("Temperatura : ");
        Serial.print(temperatura,1);
        Serial.println(" C");

        Serial.print("Humedad Aire: ");
        Serial.print(humedadAire,1);
        Serial.println(" %");

        Serial.print("Humedad Suelo: ");
        Serial.print(humedadSuelo);
        Serial.println(" %");

        Serial.print("Estado: ");
        Serial.println(estado);

        Serial.println("--------------------------------");

        //=============================
        // OLED
        //=============================

        oled.clear();

        oled.setFont(ArialMT_Plain_10);

        oled.drawString(0, 0,
                        "Temp: " +
                        String(temperatura,1) +
                        " C");

        oled.drawString(0, 16,
                        "H.Aire: " +
                        String(humedadAire,1) +
                        " %");

        oled.drawString(0, 32,
                        "H.Suelo: " +
                        String(humedadSuelo) +
                        " %");

        oled.drawString(0, 48,
                        "Estado: " +
                        String(estado));

        oled.display();
    }
    else
    {
        Serial.println("Paquete recibido con formato incorrecto");
        Serial.println(rxpacket);
    }

    // Volver a escuchar
    Radio.Rx(0);
}

//======================================================
// SETUP
//======================================================

void setup()
{
    Serial.begin(115200);

    delay(1000);

    pinMode(Vext, OUTPUT);
    digitalWrite(Vext, LOW);

    oled.init();
    oled.flipScreenVertically();

    oled.clear();
    oled.drawString(0, 0, "WILLAY RX");
    oled.drawString(0, 20, "Esperando...");
    oled.display();

    Mcu.begin(
        HELTEC_BOARD,
        SLOW_CLK_TPYE);

    RadioEvents.RxDone = OnRxDone;

    Radio.Init(&RadioEvents);

    Radio.SetChannel(RF_FREQUENCY);

    Radio.SetRxConfig(
        MODEM_LORA,
        LORA_BANDWIDTH,
        LORA_SPREADING_FACTOR,
        LORA_CODINGRATE,
        0,
        LORA_PREAMBLE_LENGTH,
        0,
        false,
        0,
        true,
        0,
        0,
        LORA_IQ_INVERSION_ON,
        true);

    Radio.Rx(0);

    Serial.println("================================");
    Serial.println(" WILLAY RECEPTOR LISTO");
    Serial.println(" Esperando paquetes...");
    Serial.println("================================");
}

//======================================================
// LOOP
//======================================================

void loop()
{
    Radio.IrqProcess();
}
