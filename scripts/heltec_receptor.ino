// =============================================================
// WILLAY · RECEPTOR MVP
// Heltec WiFi LoRa 32 V3
// Recibe datos simulados por LoRa
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
#define LORA_IQ_INVERSION_ON      false


#define BUFFER_SIZE 128


#define PIN_TX_PI 20
#define PIN_RX_PI 19



SSD1306Wire oled(
0x3c,
500000,
SDA_OLED,
SCL_OLED,
GEOMETRY_128_64,
RST_OLED
);



static RadioEvents_t RadioEvents;


char rxpacket[BUFFER_SIZE];


uint32_t pkts=0;



String evaluarEstado(int suelo)
{

if(suelo>70)
 return "HUMEDO";


if(suelo>=40)
 return "NORMAL";


if(suelo>=25)
 return "ALERTA";


if(suelo>=15)
 return "ESTRES";


return "SEVERO";

}




void mostrarOLED(
float temp,
int aire,
int suelo,
String estado
)
{

oled.clear();

oled.setFont(ArialMT_Plain_10);


oled.drawString(
0,0,
"WILLAY RX"
);


oled.drawString(
0,14,
"T:"+String(temp,1)+" C"
);


oled.drawString(
0,26,
"Suelo:"+String(suelo)+"%"
);



oled.drawString(
0,38,
estado
);



if(estado=="ESTRES" ||
   estado=="SEVERO")
{
 oled.drawString(
 0,52,
 "RIEGO"
 );
}
else
{
 oled.drawString(
 0,52,
 "OK"
 );
}


oled.display();

}





void OnRxDone(
uint8_t *payload,
uint16_t size,
int16_t rssi,
int8_t snr
)
{


uint16_t n =
(size < BUFFER_SIZE-1)?
size:
BUFFER_SIZE-1;


memcpy(
rxpacket,
payload,
n
);


rxpacket[n]=0;


pkts++;


Serial.println();
Serial.println("=================");
Serial.println("PAQUETE RECIBIDO");
Serial.println("=================");


Serial.println(rxpacket);


float temp;
int hum;
int suelo;


char id[20];
int seq;



sscanf(
rxpacket,
"%[^;];%d;%f;%d;%d",
id,
&seq,
&temp,
&hum,
&suelo
);



String estado =
evaluarEstado(suelo);



Serial.println(
"ID: "+String(id)
);


Serial.println(
"SEQ: "+String(seq)
);


Serial.println(
"Temperatura: "
+String(temp)
+" C"
);


Serial.println(
"Humedad aire: "
+String(hum)
+" %"
);


Serial.println(
"Humedad suelo: "
+String(suelo)
+" %"
);



Serial.println(
"ESTADO: "
+estado
);



if(
estado=="ESTRES" ||
estado=="SEVERO"
)
{
Serial.println(
"ACCION: Activar riego"
);
}
else
{
Serial.println(
"ACCION: Monitorear"
);
}



Serial.println(
"RSSI: "
+String(rssi)
);



mostrarOLED(
temp,
hum,
suelo,
estado
);



// UART hacia Raspberry

Serial2.printf(
"$WILLAY,%s,%d,%.1f,%d,%d,%d,%d*\n",
id,
seq,
temp,
hum,
suelo,
rssi,
snr
);



Radio.Rx(0);

}





void OnRxTimeout()
{
Radio.Rx(0);
}


void OnRxError()
{
Radio.Rx(0);
}





void setup()
{

Serial.begin(115200);


Serial2.begin(
9600,
SERIAL_8N1,
PIN_RX_PI,
PIN_TX_PI
);



pinMode(
Vext,
OUTPUT
);

digitalWrite(
Vext,
LOW
);



delay(100);



oled.init();
oled.flipScreenVertically();


oled.clear();
oled.drawString(
0,
0,
"WILLAY RX BOOT"
);
oled.display();



Mcu.begin(
HELTEC_BOARD,
SLOW_CLK_TPYE
);



RadioEvents.RxDone =
OnRxDone;


RadioEvents.RxTimeout =
OnRxTimeout;


RadioEvents.RxError =
OnRxError;



Radio.Init(
&RadioEvents
);



Radio.SetChannel(
RF_FREQUENCY
);



Radio.SetRxConfig(
MODEM_LORA,
LORA_BANDWIDTH,
LORA_SPREADING_FACTOR,
LORA_CODINGRATE,
0,
LORA_PREAMBLE_LENGTH,
LORA_SYMBOL_TIMEOUT,
false,
0,
true,
0,
0,
LORA_IQ_INVERSION_ON,
true
);



Radio.Rx(0);


Serial.println(
"WILLAY RX LISTO"
);


}





void loop()
{

Radio.IrqProcess();

}
