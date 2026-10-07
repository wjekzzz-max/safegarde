export function assess(reading) {
  if (!reading.wifi?.connected || Date.now() - reading.lastSeen > 15000) return { status: 'offline', reason: '장치 Wi-Fi 연결 끊김' };
  if (reading.imu?.fallDetected) return { status: 'danger', reason: `넘어짐 감지 · 기울기 ${Math.round(reading.imu.tiltAngle)}° · 충격가속도 ${reading.imu.accelerationG.toFixed(1)} g (중력가속도)` };
  if (reading.imu?.impactDetected || reading.imu?.tiltAngle > 55) return { status: 'warning', reason: '급격한 자세 변화 감지' };
  if (!reading.fingerDetected || reading.signalQuality < 40) return { status: 'warning', reason: '센서 접촉 상태 확인 필요' };
  if (reading.spo2 < 90) return { status: 'danger', reason: `산소포화도 위험 (${reading.spo2}%)` };
  if (reading.heartRate > 120 || reading.heartRate < 45) return { status: 'danger', reason: `심박수 위험 (${reading.heartRate} BPM)` };
  if (reading.spo2 < 95) return { status: 'warning', reason: `산소포화도 주의 (${reading.spo2}%)` };
  if (reading.heartRate > 100 || reading.heartRate < 55) return { status: 'warning', reason: `심박수 주의 (${reading.heartRate} BPM)` };
  return { status: 'normal', reason: '안정적인 생체신호' };
}

export function analyzeImu(imu) {
  const { accelerometer: a, gyroscope: g } = imu;
  const accelerationG = Math.sqrt(a.x ** 2 + a.y ** 2 + a.z ** 2);
  const gyroMagnitude = Math.sqrt(g.x ** 2 + g.y ** 2 + g.z ** 2);
  const tiltAngle = Math.atan2(Math.sqrt(a.x ** 2 + a.y ** 2), Math.abs(a.z)) * 180 / Math.PI;
  const impactDetected = accelerationG >= 2.5;
  const lyingPosture = tiltAngle >= 60;
  const stillAfterImpact = (imu.stillnessMs || 0) >= 2000;
  return { ...imu, accelerationG, gyroMagnitude, tiltAngle, impactDetected, fallDetected: Boolean(imu.fallDetected || (impactDetected && lyingPosture && stillAfterImpact)) };
}
