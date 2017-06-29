#include <ArduinoJson.h>
#include <TM1637.h>
#include <DFRobotDFPlayerMini.h>
#include <Wire.h>
#include "wiring_private.h"

#define DEBUG true

#define esp8266 Serial5

#define DS3231_RTC 0x68
#define DS3231_EEPROM 0x57

#define TMCLK 3
#define TMDIO 4
#define MOTION_PIN 5
#define STOP_MODE_BTN 6
#define CHOICE_BTN 7
#define OK_BTN 8
#define DFP_BUSY_PIN 9

DFRobotDFPlayerMini dfp;
TM1637 tm(TMCLK, TMDIO);

byte second, minute, hour, day, date, month, year;
unsigned long timeCheckTime = 0;

bool isRun, checkAlarm;

int mode = 0;
unsigned long btnTime = 0;
unsigned long changeTime = 0;

int alarmNum = 1;
int alarmNumCount = -1;
String* alarmName = new String[100];

int musicNum = 1;
bool isChange = false;

int nowVolume;
int maxVolume, duration, volumeDelay;
unsigned long alarmStopTime = 0;
unsigned long volumeUpTime = 0;

int checkAlarmSeq = 0;
unsigned long checkAlarmTime = 0;
String checkAlarmCmd;
unsigned long nowTime = 0;

bool isMove = false;
unsigned long motionTime = 0;

String http;
String json;

Uart Serial2(&sercom1, 12, 10, SERCOM_RX_PAD_3, UART_TX_PAD_2);
void SERCOM1_Handler()
{
  Serial2.IrqHandler();
}

void setup() {
  pinMode(CHOICE_BTN, INPUT_PULLUP);
  pinMode(STOP_MODE_BTN, INPUT_PULLUP);
  pinMode(MOTION_PIN, INPUT_PULLUP);
  pinMode(OK_BTN, INPUT_PULLUP);
  pinMode(DFP_BUSY_PIN, INPUT);

  attachInterrupt(CHOICE_BTN, readChangeBtn, RISING);
  attachInterrupt(STOP_MODE_BTN, readStopBtn, RISING);
  attachInterrupt(OK_BTN, readOkBtn, RISING);

  isRun = false;
  checkAlarm = true;

  Wire.begin();

  loadData();

  tm.init();
  tm.set(BRIGHT_DARKEST);
  tm.point(POINT_ON);

  getTime();
  displayTime();

  Serial2.begin(9600);
  pinPeripheral(10, PIO_SERCOM);
  pinPeripheral(12, PIO_SERCOM);
  dfp.begin(Serial2);

  connectWifi();
}

void loop() {
  nowTime = millis();
  if (timeCheckTime + 1000 <= nowTime) {
    timeCheckTime = millis();
    getTime();
  }

  if (!mode && second == 0) {
    displayTime();
    if (!isRun && !checkAlarm) {
      debugMessage("checkAlarm");
      checkAlarm = true;
      checkAlarmSeq = 0;
      checkAlarmTime = millis() - 20000;
    }
  }

  if (motionTime + 1000 < nowTime) {
    if (digitalRead(MOTION_PIN)) {
      debugMessage("Detection (HIGH Signal)");
      isMove = true;
      motionTime = millis() + 300000 ;
    }
    else {
      debugMessage("Nothing (LOW Signal)");
      isMove = false;
      motionTime = millis();
    }
  }

  if (isChange) {
    debugMessage("save start");
    musicNum = dfp.readCurrentFileNumber();
    saveData(alarmNum, musicNum);
    isChange = false;
    debugMessage("save end");
  }

  if (isRun) {
    if (alarmStopTime <= nowTime) {
      stopAlarm();
    }
    if (nowVolume < maxVolume && volumeUpTime <= nowTime) {
      volumeUpTime = millis() + volumeDelay;
      dfp.volume(++nowVolume);
    }
  }

  if (!mode && !isRun && checkAlarm) {
    if (checkAlarmSeq == 0 && (checkAlarmTime + 20000 <= nowTime)) {
      debugMessage("startCheck");
      esp8266.println("AT+CIPSTART=\"TCP\",\"14.45.224.136\",3000");
      esp8266.flush();
      if (esp8266.find("OK")) {
        debugMessage("TCP Connect Success");
        checkAlarmSeq = 1;
      } else {
        debugMessage("TCP Connect Fail");
        checkAlarmSeq = 0;
      }
      checkAlarmTime = millis();
    }
    else if (checkAlarmSeq == 1 && (checkAlarmTime + 1000 <= nowTime)) {
      checkAlarmCmd = "GET /api/arduino/alarms/" + String(alarmNum + 1) + "/" + isMove;
      esp8266.println("AT+CIPSEND=" + String(checkAlarmCmd.length() + 4));
      checkAlarmSeq = 2;
      checkAlarmTime = millis();
    }
    else if (checkAlarmSeq == 2 && (checkAlarmTime + 300 <= nowTime)) {
      if (esp8266.find(">")) {
        debugMessage("sending...");
        esp8266.println(checkAlarmCmd);
        esp8266.println();
        esp8266.flush();
        if (esp8266.available()) {
          http = esp8266.readString();
          StaticJsonBuffer<200> jsonBuffer;
          JsonObject& json = jsonBuffer.parseObject(parseJson(http));
          String su = json["success"];
          String maxVolumeStr = (json["maxVolume"]);
          maxVolume = maxVolumeStr.toInt();
          if (!(su == "")) {
            debugMessage("Find");
            String maxVolumeStr = (json["maxVolume"]);
            maxVolume = maxVolumeStr.toInt();
            String durationStr = (json["duration"]);
            duration = durationStr.toInt();
            String volumeDelayStr = (json["volumeDelay"]);
            volumeDelay = volumeDelayStr.toInt();
            alarmStopTime = millis() + (duration * 60000);
            volumeDelay =  (volumeDelay * 60000) / (maxVolume - 5);
            volumeUpTime = millis() + volumeDelay;
            startAlarm();
            debugMessage(maxVolume);
            debugMessage(duration);
            debugMessage(volumeDelay);
          } else {
            debugMessage("cant Find");
          }
        }
        esp8266.println("AT+CIPCLOSE");
        checkAlarm = false;
      }
    }
  }

}

void connectWifi() {
  debugMessage("connecting wifi");
  esp8266.begin(9600);
  esp8266.println("AT+RST");
  delay(500);
  esp8266.flush();
  if (esp8266.find("OK")) {
    debugMessage("Reset OK");
  }
  esp8266.println("AT+CIOBAUD=9600");
  delay(500);
  esp8266.flush();
  if (esp8266.find("OK")) {
    debugMessage("Baud Change OK");
  }
  esp8266.println("AT+CWMODE=1");
  delay(500);
  esp8266.flush();
  if (esp8266.find("OK")) {
    debugMessage("Mode Change OK");
  }
  esp8266.println("AT+CWJAP=\"wevo\",\"\"");
  delay(5000);
  esp8266.flush();
  if (esp8266.find("OK")) {
    debugMessage("Wifi Connect OK");
  }

  esp8266.println("AT+CIPSTART=\"TCP\",\"14.45.224.136\",3000");
  delay(1000);
  esp8266.flush();
  if (esp8266.find("OK")) {
    debugMessage("tcp Connect OK");
  }
  checkAlarmCmd = "GET /api/start/" + String(alarmNum);
  esp8266.println("AT+CIPSEND=" + String(checkAlarmCmd.length() + 4));
  delay(1000);
  esp8266.flush();
  if (esp8266.find(">")) {
    debugMessage("ready OK");
  }
  esp8266.println(checkAlarmCmd);
  esp8266.println();
  debugMessage("start start");
  esp8266.flush();
  if (esp8266.available()) {
    http = esp8266.readString();
    StaticJsonBuffer<200> jsonBuffer;
    JsonObject& json = jsonBuffer.parseObject(parseJson(http));
    String lengthStr = (json["length"]);
    alarmNumCount = lengthStr.toInt();
    String timeData = json["time"];
    setTime(timeData);
    displayTime();
  }
  esp8266.println("AT+CIPCLOSE");
}

String parseJson(String str) {
  int index = str.lastIndexOf("{");
  int index2 = str.lastIndexOf("}");
  return str.substring(index, index2 + 1);
}

void startAlarm() {
  nowVolume = 5;
  dfp.volume(nowVolume);
  dfp.loop(musicNum);
  isRun = true;
}

void stopAlarm() {
  dfp.stop();
  isRun = false;
}

void displaySong() {
  tm.display(0, 17);
  tm.display(1, 0);
  tm.display(2, 18);
  tm.display(3, 6);
}

void displayUser(int number) {
  tm.display(0, 16);
  tm.display(1, 16);
  if (number >= 10) {
    tm.display(2, number / 10);
  } else {
    tm.display(2, 16);
  }
  tm.display(3, number % 10);
}

void displayTime() {
  if ((hour % 12) >= 10) {
    tm.display(0, hour % 12 / 10);
  } else {
    tm.display(0, 0);
  }
  tm.display(1, (hour % 12) % 10);
  tm.display(2, minute / 10);
  tm.display(3, minute % 10);
}


byte decToBcd(byte val)
{
  return ( (val / 10 * 16) + (val % 10) );
}

byte bcdToDec(byte val) {
  return (((val & B11110000) >> 4) * 10 + (val & B00001111));
}

void setTime(String timeData)
{
  year    = (byte) ((timeData[0] - 48) * 10 +  (timeData[1] - 48));
  month   = (byte) ((timeData[2] - 48) * 10 +  (timeData[3] - 48));
  date    = (byte) ((timeData[4] - 48) * 10 +  (timeData[5] - 48));
  hour   = (byte) ((timeData[6] - 48) * 10 +  (timeData[7] - 48));
  minute = (byte) ((timeData[8] - 48) * 10 +  (timeData[9] - 48));
  second = (byte) ((timeData[10] - 48) * 10 + (timeData[11] - 48));
  day     = (byte) (timeData[12] - 48) + 1;

  Wire.beginTransmission(DS3231_RTC);
  Wire.write(0x00);
  Wire.write(decToBcd(second));
  Wire.write(decToBcd(minute));
  Wire.write(decToBcd(hour));
  Wire.write(decToBcd(day));
  Wire.write(decToBcd(date));
  Wire.write(decToBcd(month));
  Wire.write(decToBcd(year));
  Wire.endTransmission();
}

void getTime()
{
  // send request to receive data starting at register 0
  Wire.beginTransmission(DS3231_RTC); // 104 is DS3231 device address
  Wire.write(0x00); // start at register 0
  Wire.endTransmission();
  Wire.requestFrom(DS3231_RTC, 7); // request seven bytes

  if (Wire.available()) {
    second = bcdToDec(Wire.read());
    minute = bcdToDec(Wire.read());
    hour   = bcdToDec(Wire.read());
    day     = bcdToDec(Wire.read());
    date    = bcdToDec(Wire.read());
    month   = bcdToDec(Wire.read());
    year    = bcdToDec(Wire.read());
  }

}

void loadData() {
  Wire.beginTransmission(DS3231_EEPROM); // 104 is DS3231 device address
  Wire.write(0x00); // start at register 0
  Wire.write(0x00); // start at register 0
  Wire.endTransmission();
  Wire.requestFrom(DS3231_EEPROM, 2); // request seven bytes

  if (Wire.available()) {
    alarmNum = bcdToDec(Wire.read());
    musicNum = bcdToDec(Wire.read());
  }
}

void saveData(int alarmNum, int musicNum) {
  Wire.beginTransmission(DS3231_EEPROM); // 104 is DS3231 device address
  Wire.write(0x00); // start at register 0
  Wire.write(0x00); // start at register 0
  Wire.write(decToBcd(alarmNum));
  Wire.write(decToBcd(musicNum));
  Wire.endTransmission();
}

void readOkBtn() {
  if (btnTime + 500 < millis()) {
    if (mode != 0) {
      debugMessage("okbtn push");
      dfp.stop();
      mode = 0;
      isChange = true;
      displayTime();
      btnTime = millis();
    }
  }
}
void readStopBtn() {
  if (btnTime + 500 < millis()) {
    if (mode != 0) {
      mode = (mode == 1) ? 2 : 1;
      if (mode == 1) {
        dfp.pause();
        displayUser(alarmNum + 1);
      }
      else if (mode == 2) {
        dfp.play(musicNum);
        displaySong();
      }
    } else {
      stopAlarm();
    }
    debugMessage("stopbtn push");
    btnTime = millis();
  }
}

void readChangeBtn() {
  if (btnTime + 500 < millis()) {
    if (mode != 0) {
      if (mode == 1 ) {
        alarmNum = (alarmNum + 1) % alarmNumCount;
        displayUser(alarmNum + 1);
      } else if (mode == 2) {
        dfp.next();
      }
    } else {
      displayUser(alarmNum + 1);
      mode = 1;
    }
    debugMessage("choicebtn push");
    btnTime = millis();
  }
}

void debugMessage(int message) {
  if (DEBUG) {
    SerialUSB.println(message);
  }
}
void debugMessage(String message) {
  if (DEBUG) {
    SerialUSB.println(message);
  }
}

