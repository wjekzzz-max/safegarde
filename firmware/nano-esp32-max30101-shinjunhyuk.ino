// SAFE telemetry sender for Arduino Nano ESP32 + MAX30101/MAX30102.
// Configure Wi-Fi and the computer's LAN IP below before uploading.
#include <Wire.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClient.h>
#include "MAX30105.h"
#include "spo2_algorithm.h"

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
const int32_t SPO2_WINDOW = 100;
const int32_t SPO2_RECALC_SAMPLES = 25;
const unsigned long SEND_INTERVAL_MS = 1000;

MAX30105 heartSensor;
uint32_t irSamples[SPO2_WINDOW];
uint32_t redSamples[SPO2_WINDOW];
int32_t sampleCount = 0;
int32_t samplesSinceCalculation = 0;
int averageBPM = 0;
bool wristDetected = false;
int spo2 = 0;
int signalQuality = 0;
int8_t heartRateValid = 0;
int8_t spo2Valid = 0;
long latestIR = 0;
long latestRed = 0;
unsigned long lastSendTime = 0;
unsigned long lastWifiAttempt = 0;
bool lastButtonState = HIGH;
unsigned long lastButtonTime = 0;
const unsigned long DEBOUNCE_MS = 50;

void resetMeasurements() {
  averageBPM = 0;
  sampleCount = 0;
  samplesSinceCalculation = 0;
  spo2 = 0;
  spo2Valid = false;
  heartRateValid = false;
  signalQuality = 0;
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

void addSensorSample(uint32_t irValue, uint32_t redValue) {
  if (sampleCount < SPO2_WINDOW) {
    irSamples[sampleCount] = irValue;
    redSamples[sampleCount] = redValue;
    sampleCount++;
  } else {
    for (int32_t i = 1; i < SPO2_WINDOW; i++) {
      irSamples[i - 1] = irSamples[i];
      redSamples[i - 1] = redSamples[i];
    }
    irSamples[SPO2_WINDOW - 1] = irValue;
    redSamples[SPO2_WINDOW - 1] = redValue;
  }

  samplesSinceCalculation++;
  if (sampleCount < SPO2_WINDOW || samplesSinceCalculation < SPO2_RECALC_SAMPLES) return;
  samplesSinceCalculation = 0;

  int32_t calculatedBPM = 0;
  int32_t calculatedSpO2 = 0;
  int8_t calculatedHeartRateValid = 0;
  int8_t calculatedSpO2Valid = 0;
  maxim_heart_rate_and_oxygen_saturation(
    irSamples, SPO2_WINDOW, redSamples,
    &calculatedSpO2, &calculatedSpO2Valid,
    &calculatedBPM, &calculatedHeartRateValid
  );

  heartRateValid = calculatedHeartRateValid;
  spo2Valid = calculatedSpO2Valid;
  averageBPM = (heartRateValid && calculatedBPM >= 40 && calculatedBPM <= 200)
    ? calculatedBPM : 0;
  spo2 = (spo2Valid && calculatedSpO2 >= 70 && calculatedSpO2 <= 100)
    ? calculatedSpO2 : 0;
  if (averageBPM == 0 || spo2 == 0) {
    signalQuality = 30;
  } else {
    signalQuality = 80;
  }
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

  // Drain the sensor FIFO. getIR()/getRed() alone can repeatedly return an old sample.
  heartSensor.check();
  while (heartSensor.available()) {
    latestIR = heartSensor.getIR();
    latestRed = heartSensor.getRed();
    heartSensor.nextSample();
    wristDetected = latestIR > WRIST_THRESHOLD;

    if (wristDetected) {
      addSensorSample((uint32_t)latestIR, (uint32_t)latestRed);
    } else {
      averageBPM = 0;
      spo2 = 0;
      spo2Valid = false;
      heartRateValid = false;
      signalQuality = 0;
      sampleCount = 0;
      samplesSinceCalculation = 0;
    }
  }

  sendTelemetry();
  delay(5);
}
