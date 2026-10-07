const history = (value) => [value - 3, value - 2, value - 1, value, value - 1, value, value];
const worker = (id, number, name, area, heartRate, motion = 'normal') => ({ id, number, name, area, heartRate, motion, fallDetected: false, deviceConnected: true, noMotionSeconds: 0, updatedAgo: 3, history: history(heartRate) });

export const initialWorkers = [
  worker('W01', '01', '김민수', 'A-01 조립 작업구역', 78), worker('W02', '02', '이현우', 'A-02 용접 작업구역', 82),
  worker('W03', '03', '최서준', 'C-01 자재 적재구역', 112),
  { ...worker('W04', '04', '박도윤', 'B-02 용접 작업구역', 126, 'none'), fallDetected: true, noMotionSeconds: 18, history: [70, 72, 75, 80, 95, 110, 126], accelerometer: { x: 0.12, y: -0.05, z: 9.81 } },
  worker('W05', '05', '정우진', 'A-01 조립 작업구역', 74), worker('W06', '06', '서지훈', 'B-01 조립 작업구역', 80),
  worker('W07', '07', '강민재', 'D-01 고소 작업구역', 108, 'sudden'), worker('W08', '08', '윤도현', 'C-02 설비 점검구역', 76),
  worker('W09', '09', '한예준', 'D-01 고소 작업구역', 104), worker('W10', '10', '문태윤', 'B-01 조립 작업구역', 77),
  worker('W11', '11', '배성민', 'B-02 용접 작업구역', 84), worker('W12', '12', '권영준', 'C-02 설비 점검구역', 83),
];

export const initialAlerts = [
  { workerId: 'W04', time: '20:31:42', type: 'danger', message: '낙상 의심 감지' },
  { workerId: 'W03', time: '20:28:15', type: 'warning', message: '심박수 상승' },
  { workerId: 'W07', time: '20:26:02', type: 'warning', message: '급격한 움직임 감지' },
];
