// =============================================================
// WILLAY · EMISOR MVP SIMULADO
// Heltec WiFi LoRa 32 V3 · ESP32-S3 + SX1262
// Genera datos ficticios y los transmite por LoRa
// =============================================================

#include <Arduino.h>
#include "LoRaWan_APP.h"
#include "HT_SSD1306Wire.h"


// ================= RADIO =================

#define RF_FREQUENCY              915000000
#define TX_OUTPUT_POWER           17
#define LORA_BANDWIDTH            0
#define LORA_SPREADING_FACTOR     9
#define LORA_CODINGRATE           1
#define LORA_PREAMBLE_LENGTH      8
#define LORA_IQ_INVERSION_ON      false

#define BUFFER_SIZE 128


// ================= CONFIG =================

#define DEVICE_ID "EMI-001"

#define ENVIO_MS 5000   // 5 segundos para demo


// ================= OLED =================

SSD1306Wire oled(
  0x3c,
  500000,
  SDA_OLED,
  SCL_OLED,
  GEOMETRY_128_64,
  RST_OLED
);


// ================= LORA =================

static RadioEvents_t RadioEvents;

char txpacket[BUFFER_SIZE];

volatile bool loraIdle = true;

uint32_t lastSend = 0;
uint32_t seq = 0;


// ================= DATOS SIMULADOS =================


struct DatosCampo {

  float temperatura;
  int humedadAire;
  int humedadSuelo;

};


DatosCampo simulacion[] =
{

 {12.5,82,78},
 {13.8,79,71},
 {15.2,74,65},
 {16.4,70,58},
 {17.8,64,49},
 {18.9,59,40},
 {20.4,53,31},
 {22.1,47,24},
 {23.5,42,18},
 {24.8,38,12}

};


int indice = 0;



// ================= FUNCIONES =================


void OnTxDone()
{
  loraIdle=true;
  Serial.println("TX DONE");
}


void OnTxTimeout()
{
  Radio.Sleep();
  loraIdle=true;
  Serial.println("TX TIMEOUT");
}



String estadoCultivo(int suelo)
{

  if(suelo > 70)
    return "HUMEDO";

  else if(suelo >=40)
    return "NORMAL";

  else if(suelo >=25)
    return "ALERTA";

  else if(suelo >=15)
    return "ESTRES";

  else
    return "SEVERO";

}




void mostrarOLED(
float t,
int aire,
int suelo)
{

 oled.clear();

 oled.setFont(ArialMT_Plain_10);

 oled.drawString(
 0,
 0,
 "WILLAY MVP"
 );


 oled.drawString(
 0,
 15,
 "Temp:"
 +String(t,1)
 +" C"
 );


 oled.drawString(
 0,
 30,
 "Suelo:"
 +String(suelo)
 +"%"
 );


 oled.drawString(
 0,
 45,
 estadoCultivo(suelo)
 );


 oled.display();

}





void setup()
{

 Serial.begin(115200);

 delay(500);



 pinMode(Vext,OUTPUT);
 digitalWrite(Vext,LOW);


 oled.init();
 oled.flipScreenVertically();


 oled.clear();
 oled.drawString(0,0,"WILLAY START");
 oled.display();



 Mcu.begin(
 HELTEC_BOARD,
 SLOW_CLK_TPYE
 );


 RadioEvents.TxDone =
 OnTxDone;

 RadioEvents.TxTimeout =
 OnTxTimeout;



 Radio.Init(
 &RadioEvents
 );


 Radio.SetChannel(
 RF_FREQUENCY
 );


 Radio.SetTxConfig(
 MODEM_LORA,
 TX_OUTPUT_POWER,
 0,
 LORA_BANDWIDTH,
 LORA_SPREADING_FACTOR,
 LORA_CODINGRATE,
 LORA_PREAMBLE_LENGTH,
 false,
 true,
 0,
 0,
 LORA_IQ_INVERSION_ON,
 3000
 );


 Serial.println(
 "WILLAY EMISOR MVP LISTO"
 );


}





void loop()
{


 Radio.IrqProcess();



 if(
 loraIdle &&
 millis()-lastSend > ENVIO_MS
 )
 {


 DatosCampo d =
 simulacion[indice];


 seq++;


 // ID;seq;temperatura;humedad;suelo

 snprintf(
 txpacket,
 BUFFER_SIZE,
 "%s;%lu;%.1f;%d;%d",
 DEVICE_ID,
 seq,
 d.temperatura,
 d.humedadAire,
 d.humedadSuelo
 );


 Serial.println(
 "TX > "
 +String(txpacket)
 );


 Serial.println(
 "Estado: "
 +estadoCultivo(d.humedadSuelo)
 );



 mostrarOLED(
 d.temperatura,
 d.humedadAire,
 d.humedadSuelo
 );



 loraIdle=false;


 Radio.Send(
 (uint8_t*)txpacket,
 strlen(txpacket)
 );



 lastSend=millis();



 indice++;

 if(indice>=10)
 {
   indice=0;
 }


 }



}
