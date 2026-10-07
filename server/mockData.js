const people = [
  ['W01','01','김민수','A-01 조립 작업구역',76], ['W02','02','이현우','A-02 용접 작업구역',83],
  ['W03','03','최서준','C-01 자재 적재구역',106], ['W04','04','박도윤','B-02 용접 작업구역',128],
  ['W05','05','정우진','A-01 조립 작업구역',72], ['W06','06','한지호','B-01 조립 작업구역',79],
  ['W07','07','강민재','D-01 고소 작업구역',88], ['W08','08','오도현','C-02 설비 점검구역',75],
];

export const workers = people.map(([id, number, name, area, heartRate], index) => ({
  id, number, name, area,
  deviceName: `SAFE-NANO-${String(index + 1).padStart(3, '0')}`,
  deviceId: `ESP32-MAX-${String(index + 1).padStart(3, '0')}`,
  heartRate, spo2: index === 3 ? 91 : index === 2 ? 94 : 97 + (index % 2),
  ir: 85000 + index * 1743, red: 67000 + index * 1311,
  signalQuality: index === 3 ? 82 : 93 + (index % 6), fingerDetected: true,
  wifi: { connected: true, ssid: 'SAFE_FACTORY_2G', rssi: -42 - index * 3 },
  imu: {
    accelerometer: { x: 0.02, y: -0.03, z: 0.99 },
    gyroscope: { x: 1.2, y: -0.8, z: 0.4 },
    accelerationG: 0.99, gyroMagnitude: 1.5, tiltAngle: 2.1,
    impactDetected: false, stillnessMs: 0, fallDetected: false,
  },
  history: Array.from({ length: 24 }, (_, i) => Math.round(heartRate + Math.sin(i / 2) * 3)),
  lastSeen: Date.now(),
}));

export const alerts = [];
