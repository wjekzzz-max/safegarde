// SAFE telemetry sender for Arduino Nano ESP32 + MAX30101/MAX30102.
// Configure Wi-Fi and the computer's LAN IP below before uploading.
#include <Wire.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClient.h>
#include "MAX30105.h"
#include "heartRate.h"

const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
// Use the computer's LAN IPv4 address, not localhost (example: 192.168.0.12).
const char* API_URL = "http://192.168.0.12:4000/api/telemetry";
// This deviceName is registered to 신준혁 in server/mockData.js.
const char* DEVICE_NAME = "SAFE-NANO-001";
// Leave empty unless DEVICE_API_KEY is configured in the server's .env file.
const char* DEVICE_API_KEY = "";

const int RESET_BUTTON = D5; // Optional button from D5 to GND.
const long WRIST_THRESHOLD = 10000;
const byte RATE_SIZE = 4;
const uint16_t SPO2_WINDOW = 100;
const unsigned long SAMPLE_INTERVAL_MS = 10;
const unsigned long SEND_INTERVAL_MS = 1000;

MAX30105 heartSensor;
byte rates[RATE_SIZE] = {0, 0, 0, 0};
byte rateSpot = 0;
long lastBeat = 0;
int averageBPM = 0;
bool wristDetected = false;
int spo2 = 0;
int signalQuality = 0;
bool spo2Valid = false;
long irSamples[SPO2_WINDOW];
long redSamples[SPO2_WINDOW];
uint16_t sampleCount = 0;
uint16_t sampleIndex = 0;
long latestIR = 0;
long latestRed = 0;
unsigned long lastSampleTime = 0;
unsigned long lastSendTime = 0;
unsigned long lastWifiAttempt = 0;
bool lastButtonState = HIGH;
unsigned long lastButtonTime = 0;
const unsigned long DEBOUNCE_MS = 50;

void resetMeasurements() {
  averageBPM = 0;
  lastBeat = 0;
  rateSpot = 0;
  for (byte i = 0; i < RATE_SIZE; i++) rates[i] = 0;
  sampleCount = 0;
  sampleIndex = 0;
  spo2 = 0;
  spo2Valid = false;
  Serial.println("Measurements reset");
}

void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED || millis() - lastWifiAttempt < 5000) return;
  lastWifiAttempt = millis();
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.printf("Connecting to Wi-Fi: %s\n", WIFI_SSID);
}

void readButton() {
  const bool buttonState = digitalRead(RESET_BUTTON);
  if (buttonState == LOW && lastButtonState == HIGH && millis() - lastButtonTime > DEBOUNCE_MS) {
    lastButtonTime = millis();
    resetMeasurements();
  }
  lastButtonState = buttonState;
}

void updateHeartRate(long irValue) {
  if (!checkForBeat(irValue)) return;
  const long now = millis();
  const long delta = now - lastBeat;
  lastBeat = now;
  if (delta <= 0) return;

  const float bpm = 60000.0f / delta;
  if (bpm < 40 || bpm > 200) return;
  rates[rateSpot] = (byte)bpm;
  rateSpot = (rateSpot + 1) % RATE_SIZE;

  int total = 0;
  int validCount = 0;
  for (byte i = 0; i < RATE_SIZE; i++) {
    if (rates[i] > 0) { total += rates[i]; validCount++; }
  }
  if (validCount > 0) averageBPM = total / validCount;
}

void updateSpO2(long irValue, long redValue) {
  if (millis() - lastSampleTime < SAMPLE_INTERVAL_MS) return;
  lastSampleTime = millis();
  irSamples[sampleIndex] = irValue;
  redSamples[sampleIndex] = redValue;
  sampleIndex = (sampleIndex + 1) % SPO2_WINDOW;
  if (sampleCount < SPO2_WINDOW) sampleCount++;
  if (sampleCount < SPO2_WINDOW || !wristDetected) return;

  long irMin = LONG_MAX, redMin = LONG_MAX;
  long irMax = 0, redMax = 0, irSum = 0, redSum = 0;
  for (uint16_t i = 0; i < SPO2_WINDOW; i++) {
    irMin = min(irMin, irSamples[i]);
    irMax = max(irMax, irSamples[i]);
    redMin = min(redMin, redSamples[i]);
    redMax = max(redMax, redSamples[i]);
    irSum += irSamples[i];
    redSum += redSamples[i];
  }

  const float irDc = irSum / (float)SPO2_WINDOW;
  const float redDc = redSum / (float)SPO2_WINDOW;
  const float irAc = irMax - irMin;
  const float redAc = redMax - redMin;
  if (irDc <= 0 || redDc <= 0 || irAc < 100 || redAc < 100) {
    spo2Valid = false;
    signalQuality = 30;
    return;
  }

  // Prototype ratio-of-ratios estimate. Validate against a trusted oximeter;
  // MAX30101 readings are not medical measurements.
  const float ratio = (redAc / redDc) / (irAc / irDc);
  spo2 = constrain((int)roundf(110.0f - 25.0f * ratio), 70, 100);
  spo2Valid = true;
  signalQuality = constrain((int)(irAc / 150.0f), 40, 100);
}

void sendTelemetry() {
  if (millis() - lastSendTime < SEND_INTERVAL_MS) return;
  lastSendTime = millis();
  if (WiFi.status() != WL_CONNECTED) return;

  WiFiClient client;
  HTTPClient http;
  http.setTimeout(3000);
  if (!http.begin(client, API_URL)) {
    Serial.println("HTTP client setup failed");
    return;
  }
  http.addHeader("Content-Type", "application/json");
  if (DEVICE_API_KEY[0] != '\0') http.addHeader("X-Device-Key", DEVICE_API_KEY);

  const int reportedSpo2 = (wristDetected && spo2Valid) ? spo2 : 0;
  const int reportedQuality = wristDetected ? signalQuality : 0;
  String body = "{\"deviceName\":\"" + String(DEVICE_NAME) + "\",\"heartRate\":" + String(averageBPM)
    + ",\"spo2\":" + String(reportedSpo2)
    + ",\"ir\":" + String(latestIR)
    + ",\"red\":" + String(latestRed)
    + ",\"signalQuality\":" + String(reportedQuality)
    + ",\"fingerDetected\":" + String(wristDetected ? "true" : "false")
    + ",\"rssi\":" + String(WiFi.RSSI()) + "}";

  const int statusCode = http.POST(body);
  Serial.printf("HTTP %d | BPM %d | SpO2 %d | wearing %s\n", statusCode, averageBPM, reportedSpo2, wristDetected ? "yes" : "no");
  if (statusCode < 0) Serial.println(http.errorToString(statusCode));
  http.end();
}

void setup() {
  Serial.begin(115200);
  pinMode(RESET_BUTTON, INPUT_PULLUP);
  Wire.begin();

  if (!heartSensor.begin(Wire, I2C_SPEED_STANDARD)) {
    Serial.println("MAX30101/MAX30102 not detected. Check SDA/SCL and power.");
    while (true) delay(1000);
  }
  heartSensor.setup(0x1F, 4, 2, 100, 411, 4096);
  heartSensor.setPulseAmplitudeRed(0x2F);
  heartSensor.setPulseAmplitudeIR(0x2F);
  heartSensor.setPulseAmplitudeGreen(0);

  connectWiFi();
  Serial.println("SAFE wrist monitor ready; worker: 신준혁 (SAFE-NANO-001)");
}

void loop() {
  readButton();
  connectWiFi();

  latestIR = heartSensor.getIR();
  latestRed = heartSensor.getRed();
  wristDetected = latestIR > WRIST_THRESHOLD;

  if (wristDetected) {
    updateHeartRate(latestIR);
    updateSpO2(latestIR, latestRed);
  } else {
    averageBPM = 0;
    spo2 = 0;
    spo2Valid = false;
    signalQuality = 0;
    sampleCount = 0;
    sampleIndex = 0;
    lastBeat = 0;
  }

  sendTelemetry();
  delay(5);
}
