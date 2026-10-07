# SAFE 작업자 안전 관제 시스템

실제 장치 설치와 외부 네트워크 배포 절차는 [README-PRODUCTION.md](README-PRODUCTION.md)를 참고하세요.
Nano ESP32의 요청 URL, 헤더와 JSON 바디 명세는 [docs/DEVICE-API.md](docs/DEVICE-API.md)를 참고하세요.

MAX30102 생체신호 센서와 6축 IMU를 이용해 작업자의 심박수, 산소포화도, 움직임, 넘어짐 및 장치 연결 상태를 관리자 화면에서 확인하는 데모 프로젝트입니다.

현재 버전은 실제 센서 없이도 전체 흐름을 테스트할 수 있도록 서버가 더미 데이터를 생성합니다. 이후 ESP32에 MAX30102와 MPU6050 같은 6축 IMU를 연결하면 동일한 API로 실제 측정값을 전송할 수 있습니다.

> 이 프로젝트의 임계값과 판정 결과는 기능 시연용입니다. 의료 진단이나 산업 현장의 최종 안전 판정에 그대로 사용하면 안 됩니다.

## 주요 기능

- 작업자별 심박수와 산소포화도 실시간 표시
- MAX30102 IR/Red 원시값과 신호 품질 표시
- 6축 IMU의 3축 중력가속도와 3축 각속도 표시
- 충격, 기울기, 무동작을 조합한 넘어짐 판정
- ESP32 Wi-Fi 연결 여부와 RSSI 표시
- 정상, 주의, 위험, 오프라인 상태 자동 분류
- 위험 상태 발생 시 관리자 알림 생성
- 알림 확인 완료 처리
- 작업자 검색 및 상태 필터
- 정상, 넘어짐, 저산소, 빈맥, 연결 끊김 더미 시나리오
- 대시보드, 작업자 현황, 알림 기록, 장치 관리 사이드 메뉴

## 기술 구성

| 구분 | 사용 기술 | 역할 |
| --- | --- | --- |
| 프런트엔드 | React, Vite | 관제 화면, 작업자 상세 정보, 알림 및 장치 목록 |
| 백엔드 | Node.js, Express | 센서 데이터 수신, 상태 판정, 알림 관리 |
| 생체신호 | MAX30102 형식 | 심박수, SpO₂, IR/Red 원시값 |
| 움직임 | 6축 IMU 형식 | X/Y/Z 중력가속도, X/Y/Z 각속도 |
| 통신 | HTTP JSON, Wi-Fi | ESP32에서 백엔드로 텔레메트리 전송 |

## 프로젝트 구조

```text
safe-main/
├─ index.html                     Vite 진입 HTML
├─ package.json                   실행 명령과 의존성
├─ vite.config.js                 Vite 설정 및 API 프록시
├─ src/
│  ├─ main.jsx                    React 시작점
│  ├─ App.jsx                     대시보드 UI와 화면 상태
│  ├─ api.js                      백엔드 API 호출 함수
│  └─ styles.css                  화면 스타일
├─ server/
│  ├─ index.js                    Express API와 더미 데이터 스트림
│  ├─ mockData.js                 작업자, MAX30102, IMU 초기 데이터
│  └─ safety.js                   생체신호 및 넘어짐 판정
└─ firmware/
   ├─ nano-esp32-max30102-imu.ino 기존 HTTPS 자리표시자 예제
   └─ nano-esp32-max30101-shinjunhyuk.ino 신준혁용 MAX30101 Wi-Fi 연동 스케치
```

기존 `src/main.js`, `src/mockData.js`, `src/dataService.js`, `src/config.js` 등은 이전 바닐라 JavaScript 구현 파일이며 현재 React 앱의 진입점에서는 사용하지 않습니다.

## 준비 사항

- Node.js 20 이상 권장
- npm
- 실제 장치 연동 시 Arduino Nano ESP32, MAX30102, 6축 IMU
- Nano ESP32가 접속할 수 있는 Wi-Fi 또는 모바일 핫스팟
- 서로 다른 네트워크에서 사용할 경우 인터넷에 공개된 HTTPS 백엔드 주소

현재 환경 확인:

```bash
node --version
npm --version
```

## 설치 및 실행

처음 한 번 의존성을 설치합니다.

```bash
npm install
```

프런트엔드와 백엔드를 동시에 실행합니다.

```bash
npm run dev
```

실행 주소:

- 관리자 화면: http://localhost:5173
- 백엔드 API: http://localhost:4000
- 서버 상태 확인: http://localhost:4000/api/health

각 서버를 별도로 실행할 수도 있습니다.

```bash
npm run dev:client
npm run dev:server
```

프로덕션용 프런트엔드 빌드:

```bash
npm run build
```

빌드 결과는 `dist/` 폴더에 생성됩니다. `npm start`는 Express API만 실행하므로, 실제 배포 시에는 `dist/`를 정적 호스팅하거나 Express 정적 파일 제공 설정을 추가해야 합니다.

## 화면 사용 방법

### 사이드 메뉴

- `대시보드`: 화면 상단으로 이동합니다.
- `작업자 현황`: 작업자 카드 영역으로 이동하고 전체 작업자를 표시합니다.
- `알림 기록`: 관리자 알림 패널을 엽니다.
- `장치 관리`: 고유 기기 이름, 내부 ID, 담당 작업자, Wi-Fi 상태와 RSSI를 표시합니다.

### 더미 시나리오

대시보드 상단의 버튼은 `W04`, 즉 `SAFE-NANO-004` 기기의 상태를 변경합니다.

| 버튼 | 만들어지는 상태 | 예상 판정 |
| --- | --- | --- |
| 정상화 | 심박수 78 BPM, SpO₂ 98%, 정상 자세 | 정상 |
| 넘어짐 | 약 3.0g 충격, 약 83° 기울기, 2.5초 무동작 | 위험 |
| 저산소 | SpO₂ 88% | 위험 |
| 빈맥 | 심박수 132 BPM | 위험 |
| 연결 끊김 | Wi-Fi 연결 해제, 마지막 수신 20초 경과 | 오프라인 |

넘어짐 버튼을 누르면 상태 창에 다음과 유사하게 표시됩니다.

```text
넘어짐 감지 · 기울기 83° · 충격가속도 3.0 g (중력가속도)
```

## 센서 데이터 단위

### MAX30102

| 필드 | 단위 | 설명 |
| --- | --- | --- |
| `heartRate` | BPM | 분당 심박수 |
| `spo2` | % | 추정 산소포화도 |
| `ir` | 센서 원시값 | 적외선 LED 반사 측정값 |
| `red` | 센서 원시값 | 적색 LED 반사 측정값 |
| `signalQuality` | % | 애플리케이션에서 정의한 신호 품질 |
| `fingerDetected` | boolean | 피부 또는 손가락 접촉 여부 |

MAX30102가 직접 완성된 BPM과 SpO₂ 값을 제공하는 것은 아닙니다. 실제 펌웨어에서는 IR/Red 샘플에 필터와 계산 알고리즘을 적용해 값을 추정해야 합니다.

### 6축 IMU

6축은 다음 측정축을 뜻합니다.

- 가속도계: `ax`, `ay`, `az`
- 자이로스코프: `gx`, `gy`, `gz`

이 프로젝트에서 가속도 값의 `g`는 그램이 아니라 중력가속도입니다.

```text
1 g ≈ 9.81 m/s²
3.0 g ≈ 29.43 m/s²
```

자이로스코프는 각가속도가 아닌 각속도를 측정하며 단위는 `°/s`입니다. 각가속도가 필요하면 연속된 각속도의 변화량을 시간으로 나눠 계산합니다.

```text
각가속도 = (현재 각속도 - 이전 각속도) / 측정 시간 간격
```

## 넘어짐 계산 방법

### 1. 합성 중력가속도

3축 가속도를 하나의 크기로 합칩니다.

```text
합성 중력가속도 = √(ax² + ay² + az²)
```

예시:

```text
ax = 2.8g, ay = 0.9g, az = 0.35g
√(2.8² + 0.9² + 0.35²) ≈ 2.96g
```

현재 데모는 합성값이 `2.5g 이상`이면 충격 후보로 봅니다.

### 2. 합성 각속도

```text
합성 각속도 = √(gx² + gy² + gz²)
```

회전이 클수록 값이 커지며, 충격만 발생한 상황과 사람이 실제로 회전하며 넘어진 상황을 구분하는 보조 정보로 사용할 수 있습니다.

### 3. 기울기

현재 서버는 가속도 벡터를 이용해 다음처럼 기울기를 계산합니다.

```text
기울기 = atan2(√(ax² + ay²), |az|) × 180 / π
```

현재 데모에서는 `60° 이상`을 누운 자세 후보로 사용합니다.

### 4. 무동작

넘어진 뒤 움직임이 거의 없는 시간이 `2초 이상`이면 무동작 조건을 만족합니다. 정지 상태에서도 중력 때문에 가속도 크기는 약 1g이므로, 무동작을 가속도 0으로 판단하면 안 됩니다.

실제 장치에서는 다음 조건을 일정 시간 유지하는 방식이 적합합니다.

- 합성 중력가속도가 1g 근처에서 거의 변하지 않음
- 합성 각속도가 낮음
- 기울어진 자세가 유지됨

### 5. 최종 판정

현재 데모의 넘어짐 조건은 다음 세 조건의 조합입니다.

```text
2.5g 이상 충격
        +
60° 이상 기울기
        +
2초 이상 무동작
        ↓
   넘어짐 위험 판정
```

실제 장치에서는 한 요청에 세 조건을 동시에 보내기보다 `정상 → 충격 → 자세 변화 → 무동작`을 시간 순서로 추적하는 상태 머신을 ESP32 또는 서버에 구현하는 것을 권장합니다.

## 상태 판정 기준

판정 우선순위는 오프라인, 넘어짐, 급격한 자세 변화, 센서 접촉, 생체신호, 정상 순서입니다.

| 상태 | 조건 |
| --- | --- |
| 오프라인 | Wi-Fi 연결 끊김 또는 마지막 수신 후 15초 초과 |
| 위험 | 넘어짐 확정 |
| 주의 | 2.5g 이상 충격 또는 기울기 55° 초과 |
| 주의 | 센서 미접촉 또는 신호 품질 40% 미만 |
| 위험 | SpO₂ 90% 미만 |
| 위험 | 심박수 45 BPM 미만 또는 120 BPM 초과 |
| 주의 | SpO₂ 95% 미만 |
| 주의 | 심박수 55 BPM 미만 또는 100 BPM 초과 |
| 정상 | 위 조건에 해당하지 않음 |

임계값은 [server/safety.js](server/safety.js)에서 조정할 수 있습니다.

## API 명세

### 서버 상태 확인

```http
GET /api/health
```

응답 예시:

```json
{
  "ok": true,
  "service": "safe-api"
}
```

### 대시보드 데이터 조회

```http
GET /api/dashboard
```

응답에는 `workers`, `alerts`, `summary`, `generatedAt`이 포함됩니다. 프런트엔드는 이 API를 2.5초마다 조회합니다.

### 센서 데이터 전송

```http
POST /api/telemetry
Content-Type: application/json
```

정상 자세의 요청 예시:

```json
{
  "deviceName": "SAFE-NANO-001",
  "heartRate": 78,
  "spo2": 98,
  "ir": 86420,
  "red": 68110,
  "signalQuality": 95,
  "fingerDetected": true,
  "rssi": -48,
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

필수 필드:

- `deviceName`
- `heartRate`
- `spo2`
- `ir`
- `red`

IMU 값이 전달되면 서버가 합성 중력가속도, 합성 각속도, 기울기, 충격과 넘어짐 여부를 계산합니다.

성공 응답 예시:

```json
{
  "ok": true,
  "assessment": {
    "status": "normal",
    "reason": "안정적인 생체신호"
  }
}
```

등록되지 않은 `deviceName`에는 HTTP 404가 반환됩니다. 이름은 중복되면 안 되며 현재 등록 기기는 [server/mockData.js](server/mockData.js)에서 확인할 수 있습니다.

### 더미 시나리오 실행

```http
POST /api/simulation
Content-Type: application/json
```

```json
{
  "scenario": "fall"
}
```

지원 값은 `normal`, `fall`, `hypoxia`, `tachycardia`, `offline`입니다.

### 관리자 알림 확인

```http
PATCH /api/alerts/:id/acknowledge
```

알림을 확인 처리하고 `acknowledgedAt` 시간을 기록합니다.

## PowerShell API 테스트

서버 상태 확인:

```powershell
Invoke-RestMethod http://localhost:4000/api/health
```

넘어짐 시나리오 실행:

```powershell
Invoke-RestMethod `
  -Method Post `
  -ContentType 'application/json' `
  -Body '{"scenario":"fall"}' `
  http://localhost:4000/api/simulation
```

대시보드 상태 확인:

```powershell
Invoke-RestMethod http://localhost:4000/api/dashboard
```

## Arduino Nano ESP32 외부 네트워크 연결

이 프로젝트의 장치 기준은 **Arduino Nano ESP32**입니다. Nano ESP32에는 Wi-Fi 기능이 있으므로 별도 ESP8266 모듈 없이 인터넷의 HTTP/HTTPS API를 호출할 수 있습니다.

Nano ESP32와 서버가 같은 네트워크에 있을 필요는 없습니다. 단, 서버가 `localhost`나 사설 IP에만 존재하면 외부에서 접근할 수 없으므로 다음 구조가 필요합니다.

```text
Nano ESP32
   │ 작업 현장 Wi-Fi 또는 모바일 핫스팟
   │ HTTPS POST + X-Device-Key
   ▼
공용 도메인 (예: https://api.example.com)
   │
   ▼
Express API /api/telemetry
   │
   ▼
관리자 React 대시보드
```

### 1. 백엔드를 인터넷에 배포하기

Express 서버를 Node.js를 지원하는 클라우드, VPS 또는 컨테이너 서비스에 배포합니다. 배포 결과로 다음과 같은 공용 HTTPS 주소가 필요합니다.

```text
https://api.example.com/api/telemetry
```

서버는 기본적으로 `0.0.0.0`에 바인딩되므로 컨테이너나 클라우드 플랫폼에서 외부 요청을 받을 수 있습니다. 로컬 공유기 포트포워딩도 가능하지만, 동적 IP, 방화벽, TLS 인증서 및 보안 관리가 필요하므로 운영 환경에서는 공용 클라우드 배포를 권장합니다.

### 2. 서버 환경 변수 설정

`.env.example`을 참고해 서버 실행 환경에 다음 값을 등록합니다.

```env
HOST=0.0.0.0
PORT=4000
DEVICE_API_KEY=충분히-길고-예측하기-어려운-비밀키
```

`DEVICE_API_KEY`를 설정하면 `/api/telemetry`는 다음 헤더가 같은 요청만 허용합니다.

```http
X-Device-Key: 충분히-길고-예측하기-어려운-비밀키
```

저장소에 실제 Wi-Fi 비밀번호나 API 키를 커밋하지 마세요.

### 3. Nano ESP32 펌웨어 설정

신준혁의 MAX30101 손목 센서 연결에는 [신준혁용 연동 스케치](firmware/nano-esp32-max30101-shinjunhyuk.ino)를 사용합니다. 이 스케치는 현재 개발 PC와 Nano ESP32가 같은 Wi-Fi에 연결된 로컬 테스트용입니다. 서버와 실제 네트워크 주소가 있는 상태에서 다음 값을 수정합니다.

```cpp
const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* API_URL = "http://개발PC의-로컬-IP:4000/api/telemetry";
const char* DEVICE_NAME = "SAFE-NANO-001";
```

Arduino IDE에서 `SparkFun MAX3010x Sensor Library`를 설치하고, `Arduino Nano ESP32` 보드를 선택합니다. `SAFE-NANO-001`은 서버의 신준혁 작업자에 연결된 장치 이름입니다. 이 펌웨어는 BPM, SpO₂ 추정치, IR/Red 원시값을 전송합니다. SpO₂는 프로토타입 추정치이며 의료 측정값이 아닙니다. 스케치에는 IMU가 포함되어 있지 않습니다.

### 4. 업로드 및 확인

1. Arduino IDE에서 보드를 `Arduino Nano ESP32`로 선택합니다.
2. Wi-Fi 이름/비밀번호와 개발 PC의 로컬 IPv4 주소를 입력합니다. `ipconfig` 출력의 현재 Wi-Fi 어댑터 IPv4 주소를 사용합니다. `localhost`는 입력하지 않습니다.
3. 펌웨어를 업로드합니다.
4. 시리얼 모니터를 115200 baud로 엽니다.
5. HTTP 상태 코드가 `200`인지 확인합니다.
6. 관리자 대시보드에서 장치의 마지막 수신 시간과 RSSI를 확인합니다.

주요 HTTP 상태 코드:

| 코드 | 의미 | 확인 사항 |
| --- | --- | --- |
| 200 | 정상 수신 | 대시보드에서 데이터 확인 |
| 400 | 측정값 형식 오류 | 필수 숫자 필드와 JSON 확인 |
| 401 | 장치 인증 실패 | `X-Device-Key` 값 확인 |
| 404 | 미등록 장치 | `deviceName`이 `server/mockData.js`에 있는지 확인 |
| 음수 | Nano ESP32 통신 오류 | Wi-Fi, DNS, TLS, API 주소 확인 |

## 실제 센서 적용 시 권장 사항

- MPU6050의 가속도 범위와 자이로 범위를 펌웨어 변환식과 일치시킵니다.
- 전원 투입 후 정지 상태에서 센서 영점 오차를 보정합니다.
- IMU 샘플링은 50~100Hz 이상을 권장합니다.
- HTTP 전송 주기와 센서 샘플링 주기를 분리합니다.
- ESP32에서 고속 샘플을 버퍼링하고 특징값 또는 이벤트를 서버로 전송합니다.
- 저역통과 필터나 complementary filter를 사용해 노이즈와 자세 오차를 줄입니다.
- 착용 위치에 따라 축 방향과 임계값을 다시 보정합니다.
- 넘어짐 이후 작업자가 직접 오탐을 취소할 수 있는 기능을 고려합니다.
- 알림 실패를 대비해 재전송, 저장, 메시지 큐를 추가합니다.
- 실제 운영에서는 인증, HTTPS, 요청 검증, 데이터베이스가 필요합니다.

## 현재 데모의 제한사항

- 데이터는 메모리에만 저장되므로 서버를 재시작하면 알림과 변경 상태가 초기화됩니다.
- 사용자 로그인과 권한 관리가 없습니다.
- 외부 문자, 카카오톡, FCM 푸시 알림은 아직 연결되지 않았습니다.
- 더미 넘어짐은 한 번의 요청에 충격과 무동작 결과를 함께 넣는 간략화된 시뮬레이션입니다.
- MAX30102 측정 알고리즘과 MPU6050 드라이버는 펌웨어 예제에 포함되어 있지 않습니다.
- 센서값 임계치는 현장 검증을 거치지 않은 시연 값입니다.
- 여러 서버 인스턴스 사이의 상태 동기화가 지원되지 않습니다.

## 문제 해결

### 화면에 백엔드 연결 실패가 표시되는 경우

- `npm run dev` 터미널에서 백엔드가 실행됐는지 확인합니다.
- http://localhost:4000/api/health 에 접속합니다.
- 4000번 포트를 다른 프로그램이 사용 중인지 확인합니다.

```powershell
Get-NetTCPConnection -LocalPort 4000
```

### Nano ESP32 데이터가 들어오지 않는 경우

- Nano ESP32가 인터넷에 연결되어 있는지 확인합니다.
- `API_URL`이 외부에서 접근 가능한 HTTPS 주소인지 확인합니다.
- 공용 주소를 브라우저나 API 테스트 도구에서 먼저 호출해 봅니다.
- `X-Device-Key`와 서버의 `DEVICE_API_KEY`가 같은지 확인합니다.
- 배포 서비스가 `PORT` 환경 변수를 전달하는지 확인합니다.
- JSON의 `deviceName`이 서버 등록값과 같은지 확인합니다.
- 시리얼 모니터에서 HTTP 상태 코드를 출력해 확인합니다.

### 한글이 깨지는 경우

- 파일을 UTF-8로 저장합니다.
- VS Code 우측 하단의 인코딩 표시에서 `UTF-8`을 선택합니다.
- 터미널 출력만 깨지고 브라우저는 정상이라면 PowerShell 출력 인코딩 문제일 수 있습니다.

## 이후 확장 아이디어

- SQLite 또는 PostgreSQL을 이용한 측정 이력 저장
- WebSocket 또는 MQTT 기반 실시간 통신
- 작업자별 임계값 설정
- 알림 단계별 재전송과 관리자 에스컬레이션
- FCM, 문자, 이메일, 카카오톡 관리자 알림
- 센서 배터리 잔량과 펌웨어 버전 관리
- 낙상 전후 IMU 파형 저장과 그래프 표시
- 작업자 오탐 취소 및 긴급 구조 요청 버튼
- HTTPS, 장치별 API 키, 관리자 로그인

## 안전 안내

이 프로젝트는 교육 및 프로토타입 용도입니다. MAX30102 측정값은 의료기기 수준의 정확도를 보장하지 않으며, 넘어짐 판정도 착용 위치, 작업 동작, 충격 환경에 따라 오탐과 미탐이 발생할 수 있습니다. 실제 현장 적용 전 충분한 데이터 수집, 장치 보정, 전문가 검토 및 안전 인증 절차가 필요합니다.
