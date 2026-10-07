// Arduino Nano ESP32 + MAX30102 + 6축 IMU → 외부 SAFE HTTPS API 예제
// 실제 센서 읽기 부분은 사용하는 MAX30102/IMU 라이브러리에 맞게 교체하세요.
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>

const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// 같은 네트워크가 아니므로 인터넷에서 접근 가능한 HTTPS 주소를 사용합니다.
const char* API_URL = "https://api.example.com/api/telemetry";
const char* DEVICE_API_KEY = "YOUR_DEVICE_API_KEY";
const char* DEVICE_NAME = "SAFE-NANO-001"; // 서버에 등록된 고유한 기기 이름

WiFiClientSecure secureClient;

void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print('.');
  }
  Serial.println("\nWi-Fi connected");
}

void setup() {
  Serial.begin(115200);
  connectWiFi();

  // 개발용 설정입니다. 운영에서는 setInsecure() 대신 서버 CA 인증서를 등록하세요.
  secureClient.setInsecure();

  // Wire.begin();
  // MAX30102 및 MPU6050 등의 6축 IMU를 여기에서 초기화하세요.
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) connectWiFi();

  // 더미값: 실제 센서에서 계산하거나 읽은 값으로 교체합니다.
  int heartRate = 78;
  int spo2 = 98;
  long ir = 86420;
  long red = 68110;
  int signalQuality = 95;
  bool fingerDetected = true;
  float ax = 0.02, ay = -0.03, az = 1.00; // 중력가속도 g
  float gx = 1.2, gy = -0.8, gz = 0.4;    // 각속도 °/s
  unsigned long stillnessMs = 0;

  String body = "{\"deviceName\":\"" + String(DEVICE_NAME) + "\",\"heartRate\":" + String(heartRate)
    + ",\"spo2\":" + String(spo2)
    + ",\"ir\":" + String(ir)
    + ",\"red\":" + String(red)
    + ",\"signalQuality\":" + String(signalQuality)
    + ",\"fingerDetected\":" + String(fingerDetected ? "true" : "false")
    + ",\"rssi\":" + String(WiFi.RSSI())
    + ",\"imu\":{\"accelerometer\":{\"x\":" + String(ax, 3)
    + ",\"y\":" + String(ay, 3) + ",\"z\":" + String(az, 3)
    + "},\"gyroscope\":{\"x\":" + String(gx, 2)
    + ",\"y\":" + String(gy, 2) + ",\"z\":" + String(gz, 2)
    + "},\"stillnessMs\":" + String(stillnessMs) + "}}";

  HTTPClient http;
  http.setTimeout(10000);
  http.begin(secureClient, API_URL);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Key", DEVICE_API_KEY);

  int statusCode = http.POST(body);
  Serial.printf("HTTP %d\n", statusCode);
  if (statusCode > 0) Serial.println(http.getString());
  http.end();

  delay(2500);
}
