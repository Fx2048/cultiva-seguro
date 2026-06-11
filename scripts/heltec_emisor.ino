// =============================================================
// WILLAY · EMISOR  (Heltec WiFi LoRa 32 V3 · ESP32-S3 + SX1262)
// -------------------------------------------------------------
// Sensores:
//   - DHT22  -> GPIO2  (DATA) + pull-up 4.7k a 3V3
//   - YL69/FC28 (analog AO) -> GPIO1
// LoRa: 915 MHz (Perú/AS923-AU, usa 915 MHz por defecto; cambia si tu plan
//       regional es 868/433).  SF=9, BW=125kHz, CR=4/5, 17 dBm.
// OLED 0.96" embebida (SSD1306 128x64, I2C interna del Heltec V3).
//
// Librerías Arduino IDE necesarias (Library Manager):
//   - "Heltec ESP32 Dev-Boards" (oficial Heltec, incluye SX1262 + OLED V3)
//   - "DHT sensor library" by Adafruit
//   - "Adafruit Unified Sensor"
// Board Manager URL (Preferencias):
//   https://resource.heltec.cn/download/package_heltec_esp32_index.json
// Placa: "Heltec WiFi LoRa 32(V3)"
// =============================================================

#include <Arduino.h>
#include "LoRaWan_APP.h"     // viene con Heltec ESP32 Dev-Boards
#include "HT_SSD1306Wire.h"  // OLED del Heltec V3
#include "DHT.h"

// -------------- Config radio --------------
#define RF_FREQUENCY              915000000   // Hz  (cambiar a 868E6 o 433E6 si corresponde)
#define TX_OUTPUT_POWER           17           // dBm (máx 22 con SX1262)
#define LORA_BANDWIDTH            0            // 0=125kHz, 1=250kHz, 2=500kHz
#define LORA_SPREADING_FACTOR     9            // SF7..SF12
#define LORA_CODINGRATE           1            // 1=4/5
#define LORA_PREAMBLE_LENGTH      8
#define LORA_SYMBOL_TIMEOUT       0
#define LORA_FIX_LENGTH_PAYLOAD_ON false
#define LORA_IQ_INVERSION_ON      false
#define RX_TIMEOUT_VALUE          1000
#define BUFFER_SIZE               128

// -------------- Config sensores --------------
#define PIN_DHT       2
#define DHT_TYPE      DHT22
#define PIN_SOIL_AO   1     // ADC del YL69

#define DEVICE_ID     "EMI-001"
#define ENVIO_MS      60000UL   // cada 60 s

DHT dht(PIN_DHT, DHT_TYPE);
SSD1306Wire oled(0x3c, 500000, SDA_OLED, SCL_OLED,
                 GEOMETRY_128_64, RST_OLED);

static RadioEvents_t RadioEvents;
char txpacket[BUFFER_SIZE];
volatile bool loraIdle = true;
uint32_t lastSend = 0;
uint32_t seq = 0;

// -------------- Calibración suelo --------------
// Ajusta tras medir tu sensor: AIR=valor en aire (seco), WATER=sumergido.
const int SOIL_AIR   = 3000;
const int SOIL_WATER = 1200;

int leerHumedadSuelo() {
  long acc = 0;
  for (int i = 0; i < 16; i++) { acc += analogRead(PIN_SOIL_AO); delay(2); }
  int raw = acc / 16;
  int pct = map(raw, SOIL_AIR, SOIL_WATER, 0, 100);
  if (pct < 0)   pct = 0;
  if (pct > 100) pct = 100;
  return pct;
}

void OnTxDone(void)    { loraIdle = true; Serial.println("TX done"); }
void OnTxTimeout(void) { Radio.Sleep(); loraIdle = true; Serial.println("TX timeout"); }

void mostrarOLED(float t, float h, int s, bool ok) {
  oled.clear();
  oled.setFont(ArialMT_Plain_10);
  oled.drawString(0, 0,  "WILLAY · EMISOR");
  oled.drawString(0, 12, String("ID: ") + DEVICE_ID);
  oled.setFont(ArialMT_Plain_16);
  oled.drawString(0, 26, "T:" + String(t,1) + "C");
  oled.drawString(70,26, "H:" + String((int)h) + "%");
  oled.drawString(0, 44, "Suelo:" + String(s) + "%");
  oled.setFont(ArialMT_Plain_10);
  oled.drawString(80,48, ok ? "LoRa OK" : "TX...");
  oled.display();
}

void setup() {
  Serial.begin(115200);
  delay(200);

  // Energía del bus VEXT (alimenta OLED en Heltec V3)
  pinMode(Vext, OUTPUT); digitalWrite(Vext, LOW);
  delay(100);
  oled.init();
  oled.flipScreenVertically();
  oled.clear(); oled.drawString(0,0,"WILLAY booting..."); oled.display();

  dht.begin();
  analogReadResolution(12);                  // 0..4095
  analogSetPinAttenuation(PIN_SOIL_AO, ADC_11db);

  Mcu.begin(HELTEC_BOARD, SLOW_CLK_TPYE);    // init MCU Heltec V3
  RadioEvents.TxDone    = OnTxDone;
  RadioEvents.TxTimeout = OnTxTimeout;
  Radio.Init(&RadioEvents);
  Radio.SetChannel(RF_FREQUENCY);
  Radio.SetTxConfig(MODEM_LORA, TX_OUTPUT_POWER, 0, LORA_BANDWIDTH,
                    LORA_SPREADING_FACTOR, LORA_CODINGRATE,
                    LORA_PREAMBLE_LENGTH, LORA_FIX_LENGTH_PAYLOAD_ON,
                    true, 0, 0, LORA_IQ_INVERSION_ON, 3000);
  Serial.println("WILLAY Emisor listo");
}

void loop() {
  Radio.IrqProcess();
  if (loraIdle && (millis() - lastSend > ENVIO_MS)) {
    float t = dht.readTemperature();
    float h = dht.readHumidity();
    if (isnan(t) || isnan(h)) { t = -99; h = -99; }
    int s = leerHumedadSuelo();
    seq++;

    // Trama compacta CSV: ID;seq;T;H;S
    snprintf(txpacket, BUFFER_SIZE, "%s;%lu;%.1f;%.0f;%d",
             DEVICE_ID, (unsigned long)seq, t, h, s);

    Serial.print("TX> "); Serial.println(txpacket);
    mostrarOLED(t, h, s, false);
    loraIdle = false;
    Radio.Send((uint8_t *)txpacket, strlen(txpacket));
    lastSend = millis();
    mostrarOLED(t, h, s, true);
  }
}