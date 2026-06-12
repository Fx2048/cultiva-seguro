// =============================================================
// WILLAY · RECEPTOR / Puente LoRa→UART
// (Heltec WiFi LoRa 32 V3 · ESP32-S3 + SX1262)
// -------------------------------------------------------------
// Recibe paquetes LoRa del EMISOR y los reenvía por UART a la
// Raspberry Pi (que actúa como Gateway + SIM800L).
//
// UART hacia la Raspberry Pi:
//   Heltec GPIO20 (TX2) -> Pi GPIO15 (RX0)
//   Heltec GPIO19 (RX2) -> Pi GPIO14 (TX0)
//   GND común
// (en el prompt original se mencionó GPIO22/19; aquí usamos GPIO20/19
//  porque GPIO22 NO está expuesto como UART en el V3; ajusta si tu
//  pinout difiere y conecta GND entre Heltec y Pi).
//
// Formato de salida por Serial2:
//   $WILLAY,<id>,<seq>,<T>,<H>,<S>,<rssi>,<snr>*\n
// =============================================================

#include <Arduino.h>
#include "LoRaWan_APP.h"
#include "HT_SSD1306Wire.h"

#define RF_FREQUENCY              915000000
#define LORA_BANDWIDTH            0
#define LORA_SPREADING_FACTOR     9
#define LORA_CODINGRATE           1
#define LORA_PREAMBLE_LENGTH      8
#define LORA_SYMBOL_TIMEOUT       0
#define LORA_FIX_LENGTH_PAYLOAD_ON false
#define LORA_IQ_INVERSION_ON      false
#define RX_TIMEOUT_VALUE          0
#define BUFFER_SIZE               128

// UART2 hacia la Raspberry Pi
#define PIN_TX_PI 20
#define PIN_RX_PI 19

SSD1306Wire oled(0x3c, 500000, SDA_OLED, SCL_OLED,
                 GEOMETRY_128_64, RST_OLED);

static RadioEvents_t RadioEvents;
char rxpacket[BUFFER_SIZE];
int16_t lastRssi = 0;
int8_t  lastSnr  = 0;
uint32_t pkts = 0;
String lastLine = "";

void OnRxDone(uint8_t *payload, uint16_t size, int16_t rssi, int8_t snr) {
  uint16_t n = size < BUFFER_SIZE-1 ? size : BUFFER_SIZE-1;
  memcpy(rxpacket, payload, n); rxpacket[n] = 0;
  lastRssi = rssi; lastSnr = snr; pkts++;

  // Reenviar a la Pi
  Serial2.printf("$WILLAY,%s,%d,%d*\n", rxpacket, rssi, snr);
  Serial.printf("RX< %s | rssi=%d snr=%d\n", rxpacket, rssi, snr);

  lastLine = String(rxpacket);

  oled.clear();
  oled.setFont(ArialMT_Plain_10);
  oled.drawString(0,0,  "WILLAY · RX-GW");
  oled.drawString(0,12, "pkts: " + String(pkts));
  oled.drawString(0,24, "rssi: " + String(rssi) + " snr:" + String(snr));
  oled.drawStringMaxWidth(0,40, 128, lastLine);
  oled.display();

  Radio.Rx(0);
}
void OnRxTimeout(void)    { Radio.Rx(0); }
void OnRxError(void)      { Radio.Rx(0); }

void setup() {
  Serial.begin(115200);
  Serial2.begin(9600, SERIAL_8N1, PIN_RX_PI, PIN_TX_PI);
  pinMode(Vext, OUTPUT); digitalWrite(Vext, LOW); delay(100);
  oled.init(); oled.flipScreenVertically();
  oled.clear(); oled.drawString(0,0,"WILLAY RX boot..."); oled.display();

  Mcu.begin(HELTEC_BOARD, SLOW_CLK_TPYE);
  RadioEvents.RxDone    = OnRxDone;
  RadioEvents.RxTimeout = OnRxTimeout;
  RadioEvents.RxError   = OnRxError;
  Radio.Init(&RadioEvents);
  Radio.SetChannel(RF_FREQUENCY);
  Radio.SetRxConfig(MODEM_LORA, LORA_BANDWIDTH, LORA_SPREADING_FACTOR,
                    LORA_CODINGRATE, 0, LORA_PREAMBLE_LENGTH,
                    LORA_SYMBOL_TIMEOUT, LORA_FIX_LENGTH_PAYLOAD_ON,
                    0, true, 0, 0, LORA_IQ_INVERSION_ON, true);
  Radio.Rx(0);
  Serial.println("WILLAY Receptor listo");
}

void loop() { Radio.IrqProcess(); }