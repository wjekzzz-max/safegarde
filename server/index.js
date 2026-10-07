import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { alerts, workers } from './mockData.js';
import { analyzeImu, assess } from './safety.js';

const app = express();
const port = Number(process.env.PORT) || 4000;
const host = process.env.HOST || '0.0.0.0';
const deviceApiKey = process.env.DEVICE_API_KEY || '';
app.use(cors());
app.use(express.json());

const random = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const decorate = (worker) => ({ ...worker, ...assess(worker), updatedAgo: Math.max(0, Math.round((Date.now() - worker.lastSeen) / 1000)) });

function createAlert(worker, assessment) {
  if (!['warning', 'danger', 'offline'].includes(assessment.status)) return;
  const recent = alerts.find((a) => a.workerId === worker.id && a.level === assessment.status && Date.now() - new Date(a.createdAt).getTime() < 60000);
  if (!recent) alerts.unshift({ id: crypto.randomUUID(), workerId: worker.id, workerName: worker.name, area: worker.area, level: assessment.status, message: assessment.reason, createdAt: new Date().toISOString(), acknowledged: false });
  if (alerts.length > 30) alerts.length = 30;
}

setInterval(() => {
  workers.forEach((worker) => {
    if (!worker.wifi.connected) return;
    worker.heartRate = Math.max(42, Math.min(145, worker.heartRate + random(-2, 2)));
    worker.spo2 = Math.max(86, Math.min(100, worker.spo2 + random(-1, 1)));
    worker.ir = Math.max(1000, worker.ir + random(-1000, 1000));
    worker.red = Math.max(1000, worker.red + random(-800, 800));
    worker.signalQuality = Math.max(30, Math.min(100, worker.signalQuality + random(-2, 2)));
    if (!worker.imu.fallDetected) worker.imu = analyzeImu({ ...worker.imu, accelerometer: { x: random(-4, 4) / 100, y: random(-4, 4) / 100, z: random(97, 103) / 100 }, gyroscope: { x: random(-20, 20) / 10, y: random(-20, 20) / 10, z: random(-20, 20) / 10 }, stillnessMs: 0 });
    worker.wifi.rssi = Math.max(-90, Math.min(-30, worker.wifi.rssi + random(-2, 2)));
    worker.lastSeen = Date.now();
    worker.history = [...worker.history.slice(-29), worker.heartRate];
    createAlert(worker, assess(worker));
  });
}, 2000);

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'safe-api' }));
app.get('/api/dashboard', (_req, res) => {
  const view = workers.map(decorate);
  const summary = { all: view.length, normal: 0, warning: 0, danger: 0, offline: 0, unacknowledged: alerts.filter((a) => !a.acknowledged).length };
  view.forEach((worker) => summary[worker.status]++);
  res.json({ workers: view, alerts, summary, generatedAt: new Date().toISOString() });
});

// ESP32가 Wi-Fi를 통해 MAX30102 측정값을 전송할 실제 연결 지점입니다.
app.post('/api/telemetry', (req, res) => {
  if (deviceApiKey && req.get('x-device-key') !== deviceApiKey) return res.status(401).json({ message: '장치 API 키가 올바르지 않습니다.' });
  const { deviceName, deviceId, heartRate, spo2, ir, red, signalQuality, fingerDetected, rssi, imu } = req.body;
  const worker = deviceName
    ? workers.find((item) => item.deviceName === deviceName)
    : workers.find((item) => item.deviceId === deviceId);
  if (!worker) return res.status(404).json({ message: '등록되지 않은 장치입니다.' });
  if (![heartRate, spo2, ir, red].every(Number.isFinite)) return res.status(400).json({ message: '필수 측정값을 확인하세요.' });
  Object.assign(worker, { heartRate, spo2, ir, red, signalQuality: signalQuality ?? worker.signalQuality, fingerDetected: fingerDetected ?? true, lastSeen: Date.now() });
  if (imu?.accelerometer && imu?.gyroscope) worker.imu = analyzeImu(imu);
  worker.wifi = { ...worker.wifi, connected: true, rssi: rssi ?? worker.wifi.rssi };
  worker.history = [...worker.history.slice(-29), heartRate];
  const assessment = assess(worker); createAlert(worker, assessment);
  res.json({ ok: true, deviceName: worker.deviceName, assessment });
});

app.patch('/api/alerts/:id/acknowledge', (req, res) => {
  const alert = alerts.find((item) => item.id === req.params.id);
  if (!alert) return res.status(404).json({ message: '알림을 찾을 수 없습니다.' });
  alert.acknowledged = true; alert.acknowledgedAt = new Date().toISOString();
  res.json(alert);
});

app.post('/api/simulation', (req, res) => {
  const target = workers[3];
  const scenarios = {
    normal: () => Object.assign(target, { heartRate: 78, spo2: 98, signalQuality: 96, fingerDetected: true, wifi: { ...target.wifi, connected: true }, imu: analyzeImu({ accelerometer: { x: .02, y: -.03, z: 1 }, gyroscope: { x: 1, y: -.5, z: .3 }, stillnessMs: 0, fallDetected: false }), lastSeen: Date.now() }),
    hypoxia: () => Object.assign(target, { heartRate: 104, spo2: 88, signalQuality: 91, wifi: { ...target.wifi, connected: true }, lastSeen: Date.now() }),
    tachycardia: () => Object.assign(target, { heartRate: 132, spo2: 96, signalQuality: 94, wifi: { ...target.wifi, connected: true }, lastSeen: Date.now() }),
    offline: () => Object.assign(target, { wifi: { ...target.wifi, connected: false }, lastSeen: Date.now() - 20000 }),
    fall: () => {
      Object.assign(target, { heartRate: 112, spo2: 96, wifi: { ...target.wifi, connected: true }, imu: analyzeImu({ accelerometer: { x: 2.8, y: .9, z: .35 }, gyroscope: { x: 182, y: 96, z: 44 }, stillnessMs: 2500 }), lastSeen: Date.now() });
    },
  };
  if (!scenarios[req.body.scenario]) return res.status(400).json({ message: '지원하지 않는 시나리오입니다.' });
  scenarios[req.body.scenario](); const assessment = assess(target); createAlert(target, assessment);
  res.json({ ok: true, worker: decorate(target) });
});

app.listen(port, host, () => console.log(`SAFE API listening on http://${host}:${port}`));
