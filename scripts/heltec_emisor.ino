#include "DHT.h"
#include "LoRaWan_APP.h"
#include "HT_SSD1306Wire.h"


// =======================
// SENSORES
// =======================

#define DHT22_PIN 3
#define DHTTYPE DHT22

DHT dht22(DHT22_PIN, DHTTYPE);


#define FC28_PIN 1

const int seco = 3900;
const int humedo = 2800;


// =======================
// OLED
// =======================

SSD1306Wire oled(
0x3c,
500000,
SDA_OLED,
SCL_OLED,
GEOMETRY_128_64,
RST_OLED
);


// =======================
// LORA
// =======================

#define RF_FREQUENCY 915000000
#define TX_POWER 17

#define BUFFER_SIZE 128

char txpacket[BUFFER_SIZE];

static RadioEvents_t RadioEvents;

bool loraIdle=true;

unsigned long contador=0;



// =======================
// ESTADO
// =======================

String estadoCultivo(int h)
{

if(h>70)
return "HUMEDO";

if(h>=40)
return "NORMAL";

if(h>=25)
return "ALERTA";

if(h>=15)
return "ESTRES";

return "SEVERO";

}



// =======================
// CALLBACK LORA
// =======================

void OnTxDone()
{
    loraIdle=true;
    Serial.println("TX OK");
}


void OnTxTimeout()
{
    loraIdle=true;
    Serial.println("TX FAIL");
}



// =======================
// SETUP
// =======================

void setup()
{

Serial.begin(115200);


dht22.begin();


oled.init();
oled.flipScreenVertically();

oled.drawString(0,0,"WILLAY NODE");
oled.display();



Mcu.begin(
HELTEC_BOARD,
SLOW_CLK_TPYE
);


RadioEvents.TxDone = OnTxDone;
RadioEvents.TxTimeout = OnTxTimeout;


Radio.Init(&RadioEvents);


Radio.SetChannel(
RF_FREQUENCY
);



Radio.SetTxConfig(
MODEM_LORA,
TX_POWER,
0,
0,
9,
1,
8,
false,
true,
0,
0,
false,
3000
);


Serial.println("EMISOR LISTO");

}



// =======================
// LOOP
// =======================

void loop()
{

Radio.IrqProcess();


if(loraIdle)
{


float temp=dht22.readTemperature();
float aire=dht22.readHumidity();


int adc=analogRead(FC28_PIN);


int suelo =
map(adc,seco,humedo,0,100);


suelo=constrain(suelo,0,100);



String estado =
estadoCultivo(suelo);



contador++;



// paquete LoRa

snprintf(
txpacket,
BUFFER_SIZE,
"EMI001;%lu;%.1f;%.1f;%d;%s",
contador,
temp,
aire,
suelo,
estado.c_str()
);



Serial.println(txpacket);



loraIdle=false;


Radio.Send(
(uint8_t*)txpacket,
strlen(txpacket)
);




// OLED

oled.clear();


oled.drawString(
0,0,
"WILLAY"
);


oled.drawString(
0,15,
"T:"+String(temp,1)+"C"
);


oled.drawString(
0,30,
"S:"+String(suelo)+"%"
);


oled.drawString(
0,45,
estado
);


oled.display();



delay(5000);

}

}
