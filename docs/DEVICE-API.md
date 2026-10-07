# Nano ESP32 → SAFE 백엔드 API 연동 명세

이 문서는 Arduino Nano ESP32가 MAX30102와 6축 IMU 측정값을 SAFE 백엔드로 전송할 때 사용하는 URL, HTTP 헤더, JSON 바디와 응답 형식을 정의합니다.

## 1. 요청 요약

```http
POST https://<백엔드-공용-도메인>/api/telemetry
Content-Type: application/json
X-Device-Key: <장치-API-키>
```

- HTTP 메서드: `POST`
- 경로: `/api/telemetry`
- 요청 형식: JSON
- 운영 프로토콜: HTTPS
- 권장 전송 주기: 평상시 2.5초, 위험 이벤트는 즉시

## 2. URL 설정

### 실제 운영 환경

백엔드를 인터넷에 배포한 후 발급받은 공용 HTTPS 도메인을 사용합니다.

```text
https://safe-api.example.com/api/telemetry
```

Nano ESP32 코드:

```cpp
const char* API_URL = "https://safe-api.example.com/api/telemetry";
```

Nano ESP32와 관리자 PC가 서로 다른 Wi-Fi에 있어도 공용 주소를 통해 통신할 수 있습니다.

### 같은 네트워크에서 개발할 때

서버 PC의 내부 IP가 `192.168.0.10`이라면 다음 주소를 사용할 수 있습니다.

```text
http://192.168.0.10:4000/api/telemetry
```

이 주소는 같은 공유기에 연결된 장치에서만 접근할 수 있습니다.

### 사용할 수 없는 URL

Nano ESP32 펌웨어에 다음 주소를 입력하면 안 됩니다.

```text
http://localhost:4000/api/telemetry
http://127.0.0.1:4000/api/telemetry
```

Nano ESP32에서 `localhost`와 `127.0.0.1`은 서버 PC가 아니라 Nano ESP32 자신을 의미합니다.

## 3. 요청 헤더

장치는 두 개의 헤더를 전송해야 합니다.

```http
Content-Type: application/json
X-Device-Key: 장치-API-키
```

| 헤더 | 값 | 필수 여부 | 설명 |
| --- | --- | --- | --- |
| `Content-Type` | `application/json` | 필수 | 바디가 JSON임을 표시 |
| `X-Device-Key` | 서버와 같은 비밀키 | 운영 시 필수 | 등록된 장치의 요청인지 확인 |
| `Content-Length` | 바디 바이트 수 | 라이브러리 처리 | 대부분 HTTP 라이브러리가 자동 설정 |

서버 환경 변수:

```env
DEVICE_API_KEY=여기에-충분히-긴-무작위-키
```

Nano ESP32 설정:

```cpp
const char* DEVICE_API_KEY = "여기에-충분히-긴-무작위-키";
```

두 값은 완전히 같아야 합니다. 서버에서 `DEVICE_API_KEY`를 설정하지 않으면 현재 구현은 키 검사를 생략하지만, 공개 서버에서는 반드시 설정해야 합니다.

Nano ESP32 헤더 설정:

```cpp
http.addHeader("Content-Type", "application/json");
http.addHeader("X-Device-Key", DEVICE_API_KEY);
```

## 4. JSON 요청 바디

전체 요청 예시:

```json
{
  "deviceName": "SAFE-NANO-001",
  "heartRate": 78,
  "spo2": 98,
  "ir": 86420,
  "red": 68110,
  "signalQuality": 95,
  "fingerDetected": true,
  "rssi": -55,
  "imu": {
    "accelerometer": {
      "x": 0.02,
      "y": -0.03,
      "z": 1.0
    },
    "gyroscope": {
      "x": 1.2,
      "y": -0.8,
      "z": 0.4
    },
    "stillnessMs": 0
  }
}
```

### 최상위 필드

| 필드 | JSON 타입 | 단위 | 필수 | 설명 |
| --- | --- | --- | --- | --- |
| `deviceName` | string | 없음 | 필수 | 서버에 등록된 고유 기기 이름 |
| `deviceId` | string | 없음 | 호환용 | 이전 펌웨어와의 호환을 위한 내부 ID |
| `heartRate` | number | BPM | 필수 | 계산된 분당 심박수 |
| `spo2` | number | % | 필수 | 계산된 산소포화도 |
| `ir` | number | 원시값 | 필수 | MAX30102 IR 채널 값 |
| `red` | number | 원시값 | 필수 | MAX30102 Red 채널 값 |
| `signalQuality` | number | % | 선택 | 애플리케이션에서 계산한 신호 품질 |
| `fingerDetected` | boolean | 없음 | 선택 | 피부 접촉 여부 |
| `rssi` | number | dBm | 선택 | `WiFi.RSSI()` 반환값 |
| `imu` | object | 없음 | 선택 | 6축 IMU 측정값 |

현재 서버는 `heartRate`, `spo2`, `ir`, `red`가 모두 JSON 숫자인지 검사합니다. 숫자를 문자열로 보내면 안 됩니다.

잘못된 예:

```json
{
  "heartRate": "78"
}
```

올바른 예:

```json
{
  "heartRate": 78
}
```

### IMU 필드

| 경로 | 타입 | 단위 | 설명 |
| --- | --- | --- | --- |
| `imu.accelerometer.x` | number | g | X축 중력가속도 |
| `imu.accelerometer.y` | number | g | Y축 중력가속도 |
| `imu.accelerometer.z` | number | g | Z축 중력가속도 |
| `imu.gyroscope.x` | number | °/s | X축 각속도 |
| `imu.gyroscope.y` | number | °/s | Y축 각속도 |
| `imu.gyroscope.z` | number | °/s | Z축 각속도 |
| `imu.stillnessMs` | number | ms | 충격 후 무동작 지속 시간 |

여기서 `g`는 그램이 아니라 중력가속도입니다.

```text
1g ≈ 9.81m/s²
```

IMU를 보낼 때는 `accelerometer`와 `gyroscope` 객체를 둘 다 보내야 서버가 IMU 값을 다시 계산합니다.

## 5. 상황별 바디 예시

### 정상 상태

```json
{
  "deviceName": "SAFE-NANO-001",
  "heartRate": 78,
  "spo2": 98,
  "ir": 86420,
  "red": 68110,
  "signalQuality": 95,
  "fingerDetected": true,
  "rssi": -55,
  "imu": {
    "accelerometer": { "x": 0.02, "y": -0.03, "z": 1.0 },
    "gyroscope": { "x": 1.2, "y": -0.8, "z": 0.4 },
    "stillnessMs": 0
  }
}
```

### 넘어짐 더미 상태

```json
{
  "deviceName": "SAFE-NANO-001",
  "heartRate": 112,
  "spo2": 96,
  "ir": 90240,
  "red": 71400,
  "signalQuality": 91,
  "fingerDetected": true,
  "rssi": -58,
  "imu": {
    "accelerometer": { "x": 2.8, "y": 0.9, "z": 0.35 },
    "gyroscope": { "x": 182, "y": 96, "z": 44 },
    "stillnessMs": 2500
  }
}
```

위 값은 서버에서 대략 다음처럼 계산됩니다.

```text
합성 중력가속도: 2.96g
합성 각속도: 210.5°/s
기울기: 약 83°
무동작: 2.5초
판정: 넘어짐 위험
```

이 바디는 API 시험용입니다. 실제 장치에서는 동일한 순간에 충격값과 2.5초 무동작을 측정할 수 없으므로, Nano ESP32가 시간 순서로 상태를 추적한 후 확정된 특징값을 보내야 합니다.

### 센서 접촉 불량

```json
{
  "deviceName": "SAFE-NANO-001",
  "heartRate": 0,
  "spo2": 0,
  "ir": 1200,
  "red": 900,
  "signalQuality": 15,
  "fingerDetected": false,
  "rssi": -55
}
```

`fingerDetected`가 `false`이면 서버는 생체신호 숫자보다 센서 접촉 상태를 우선해 주의로 판정합니다.

## 6. 성공 응답

정상 판정 예시:

```http
HTTP/1.1 200 OK
Content-Type: application/json
```

```json
{
  "ok": true,
  "assessment": {
    "status": "normal",
    "reason": "안정적인 생체신호"
  }
}
```

넘어짐 판정 예시:

```json
{
  "ok": true,
  "assessment": {
    "status": "danger",
    "reason": "넘어짐 감지 · 기울기 83° · 충격가속도 3.0 g (중력가속도)"
  }
}
```

`assessment.status` 값:

| 값 | 의미 |
| --- | --- |
| `normal` | 정상 |
| `warning` | 주의 |
| `danger` | 위험 |
| `offline` | 오프라인 |

## 7. 오류 응답

### API 키 오류

```http
HTTP/1.1 401 Unauthorized
```

```json
{
  "message": "장치 API 키가 올바르지 않습니다."
}
```

### 미등록 장치

```http
HTTP/1.1 404 Not Found
```

```json
{
  "message": "등록되지 않은 장치입니다."
}
```

기기 이름은 현재 `server/mockData.js`에 등록되어 있어야 하며 중복되면 안 됩니다. 현재 서버는 이전 펌웨어 호환을 위해 `deviceName`이 없을 때만 `deviceId`를 사용합니다.

### 필수 측정값 누락 또는 타입 오류

```http
HTTP/1.1 400 Bad Request
```

```json
{
  "message": "필수 측정값을 확인하세요."
}
```

## 8. Nano ESP32 전송 코드

전체 예제는 `firmware/nano-esp32-max30102-imu.ino`에 있습니다. 핵심 요청 부분은 다음과 같습니다.

```cpp
WiFiClientSecure secureClient;
HTTPClient http;

http.begin(secureClient, API_URL);
http.addHeader("Content-Type", "application/json");
http.addHeader("X-Device-Key", DEVICE_API_KEY);

int statusCode = http.POST(body);

Serial.printf("HTTP %d\n", statusCode);
if (statusCode > 0) {
  Serial.println(http.getString());
}

http.end();
```

운영 환경에서는 서버 CA 인증서를 등록해야 합니다. 예제의 `secureClient.setInsecure()`는 개발 확인용이며 실제 배포에 사용하면 안 됩니다.

## 9. curl 테스트

```bash
curl -X POST "https://safe-api.example.com/api/telemetry" \
  -H "Content-Type: application/json" \
  -H "X-Device-Key: 장치-API-키" \
  -d '{
    "deviceName":"SAFE-NANO-001",
    "heartRate":78,
    "spo2":98,
    "ir":86420,
    "red":68110,
    "signalQuality":95,
    "fingerDetected":true,
    "rssi":-55,
    "imu":{
      "accelerometer":{"x":0.02,"y":-0.03,"z":1.0},
      "gyroscope":{"x":1.2,"y":-0.8,"z":0.4},
      "stillnessMs":0
    }
  }'
```

## 10. PowerShell 테스트

```powershell
$headers = @{
  'X-Device-Key' = '장치-API-키'
}

$body = @{
  deviceName = 'SAFE-NANO-001'
  heartRate = 78
  spo2 = 98
  ir = 86420
  red = 68110
  signalQuality = 95
  fingerDetected = $true
  rssi = -55
  imu = @{
    accelerometer = @{ x = 0.02; y = -0.03; z = 1.0 }
    gyroscope = @{ x = 1.2; y = -0.8; z = 0.4 }
    stillnessMs = 0
  }
} | ConvertTo-Json -Depth 5

Invoke-RestMethod `
  -Uri 'https://safe-api.example.com/api/telemetry' `
  -Method Post `
  -Headers $headers `
  -ContentType 'application/json' `
  -Body $body
```

## 11. 전송 실패 처리

Nano ESP32는 상태 코드에 따라 다음처럼 처리하는 것이 좋습니다.

| 결과 | 장치 처리 |
| --- | --- |
| 200 | 전송 성공으로 처리 |
| 400 | 바디 생성과 센서값 타입 확인, 같은 요청의 무한 재시도 금지 |
| 401 | 장치 키 오류 표시, 운영 설정 확인 |
| 404 | 장치 등록 오류 표시 |
| 500 이상 | 로컬 큐에 저장하고 일정 시간 후 재전송 |
| 음수/연결 실패 | Wi-Fi와 TLS 확인 후 지수 백오프로 재연결 |

위험 이벤트에는 고유 `eventId`와 측정 시각을 추가하고, 서버에서 중복 이벤트를 제거하는 기능을 추후 구현하는 것을 권장합니다. 현재 백엔드는 이 두 필드를 아직 저장하지 않습니다.

## 12. 전송 전 확인 목록

- [ ] URL이 공용 `https://` 주소다.
- [ ] URL 끝에 `/api/telemetry`가 있다.
- [ ] `Content-Type`이 `application/json`이다.
- [ ] `X-Device-Key`가 서버 환경 변수와 같다.
- [ ] 고유한 `deviceName`이 서버에 등록되어 있다.
- [ ] 필수 측정값을 문자열이 아닌 숫자로 보낸다.
- [ ] 중력가속도 단위가 `g`다.
- [ ] 각속도 단위가 `°/s`다.
- [ ] 시리얼 모니터에서 HTTP 200을 확인했다.
- [ ] 관리자 화면에서 장치값이 갱신된다.
