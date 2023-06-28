#include <Arduino.h>
#include <WiFi.h>
#include <ESP32Servo.h>
#include <WebSocketsServer.h>
#include <ArduinoJson.h>

const char *ssid = "HUB8735_AI_DEMO";
const char *password = "12345678";

// 需連接上TD100
// const char *ssid = "SMARTLAB";
// const char *password = "53647387";

Servo verticalServo;
Servo horizontalServo;
int verticalPin = 12;
int horizontalPin = 13;
int curPwm_v = 0;
int curPwm_h = 0;
int dPwm_v = 0;
int dPwm_h = 0;

int range[] = {200, 100, 50, 20, 10, 0};
int power[] = {50, 30, 10, 4, 2, 1};

WebSocketsServer webSocket = WebSocketsServer(81);

// 取得正負值
int sign(int value)
{
  if (value > 0)
  {
    return 1;
  }
  else if (value < 0)
  {
    return -1;
  }
  else
  {
    return 0;
  }
}

void webSocketEvent(uint8_t num, WStype_t type, uint8_t *payload, size_t length)
{

  switch (type)
  {
  case WStype_CONNECTED:
  {
    IPAddress ip = webSocket.remoteIP(num);
    Serial.printf("[%u] Connected from %d.%d.%d.%d url: %s\n", num, ip[0], ip[1], ip[2], ip[3], payload);
    // send message to client
    webSocket.sendTXT(num, "Connected");
  }
  break;
  case WStype_DISCONNECTED:
    Serial.printf("[%u] Disconnected!\n", num);
    break;

  case WStype_TEXT:
    Serial.printf("[%u] get Text: %s\n", num, payload);
    handleJson((const char *)payload, num);
    break;
  case WStype_BIN:
    Serial.printf("[%u] get binary length: %u\n", num, length);
    // send message to client
    // webSocket.sendBIN(num, payload, length);
    break;
  case WStype_ERROR:
    Serial.println("an Error Occured");
    break;
  default:
    break;
  }
}

void handleJson(const char *jsonString, uint8_t num)
{
  StaticJsonDocument<200> jsonDoc;

  DeserializationError error = deserializeJson(jsonDoc, jsonString);

  if (error)
  {
    Serial.print("deserializeJson() failed: ");
    Serial.println(error.c_str());
    return;
  }

  const char *type = jsonDoc["type"];
  const char *info = jsonDoc["info"];
  int value1 = jsonDoc["value1"];
  int value2 = jsonDoc["value2"];

  if (type)
  {
    if (strcmp(type, "rotate") == 0)
    {
      Serial.println("Rotate command received");
      if (strcmp(info, "pwm") == 0)
      {
        handlePwmRotate(value1, value2, num);
      }
      else if (strcmp(info, "deg") == 0)
      {
        handleDegRotate(value1, value2, num);
      }
    }
    else
    {
      Serial.println("Unknown command");
    }
  }
  else
  {
    Serial.println("Type field not found");
  }
}

void handlePwmRotate(int value_v, int value_h, uint8_t num)
{
  Serial.println("handlePwmRotate");

  value_v = constrain(value_v, 566, 2383);
  value_h = constrain(value_h, 566, 2383);

  verticalServo.writeMicroseconds(value_v);
  horizontalServo.writeMicroseconds(value_h);

  delay(100);
  curPwm_v = verticalServo.readMicroseconds();
  curPwm_h = horizontalServo.readMicroseconds();
  webSocket.sendTXT(num, "pwm_Completed");
}

void handleDegRotate(int value_v, int value_h, uint8_t num)
{
  // webSocket.sendTXT(num, "handleDegRotate");
  Serial.println("handleDegRotate");

  value_v = constrain(value_v, 1, 177);
  value_h = constrain(value_h, 1, 177);

  verticalServo.write(value_v);
  horizontalServo.write(value_h);

  delay(100);

  curPwm_v = verticalServo.readMicroseconds();
  curPwm_h = horizontalServo.readMicroseconds();

  webSocket.sendTXT(num, "deg_Completed");
}

void setup()
{
  Serial.begin(115200);

  verticalServo.attach(verticalPin);
  horizontalServo.attach(horizontalPin);

  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED)
  {
    delay(1000);
    Serial.println("Connecting to WiFi...");
  }
  Serial.println("Connected to WiFi");
  Serial.println("WiFi connected OK");
  Serial.print("Local IP: ");
  Serial.println(WiFi.localIP());

  webSocket.begin();
  webSocket.onEvent(webSocketEvent);

  curPwm_v = 1484;
  curPwm_h = 1484;
  
  verticalServo.writeMicroseconds(curPwm_v);
  horizontalServo.writeMicroseconds(curPwm_h);
}

void loop()
{
  webSocket.loop();
}