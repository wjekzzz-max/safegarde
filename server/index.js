import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { alerts, workers } from './mockData.js';
import { analyzeImu, assess } from './safety.js';

const app = express();
const port = Number(process.env.PORT) || 4000;
const host = process.env.HOST || '0.0.0.0';
const deviceApiKey = process.env.DEVICE_API_KEY || '';
const dangerTimers = new Map();
const randomDelta = () => Math.floor(Math.random() * 3) - 1;
app.use(cors());
app.use(express.json());

const currentAssessment = (worker) => worker.statusOverride
  ? { status: worker.statusOverride, reason: worker.statusOverrideReason }
  : assess(worker);
const decorate = (worker) => ({ ...worker, ...currentAssessment(worker), updatedAgo: Math.max(0, Math.round((Date.now() - worker.lastSeen) / 1000)) });

function createAlert(worker, assessment) {
  if (!['warning', 'danger', 'offline'].includes(assessment.status)) return;
  const recent = alerts.find((a) => a.workerId === worker.id && a.level === assessment.status && Date.now() - new Date(a.createdAt).getTime() < 60000);
  if (!recent) alerts.unshift({ id: crypto.randomUUID(), workerId: worker.id, workerName: worker.name, area: worker.area, level: assessment.status, message: assessment.reason, createdAt: new Date().toISOString(), acknowledged: false });
  if (alerts.length > 30) alerts.length = 30;
}

setInterval(() => {
  workers.forEach((worker) => {
    if (!worker.wifi.connected) return;
    worker.lastSeen = Date.now();
    const transition = worker.dangerTransition || worker.recoveryTransition;
    if (transition) {
      const { startedAt, durationMs, startHeartRate, targetHeartRate } = transition;
      const now = Date.now();
      if (now >= startedAt && worker.statusOverride) {
        worker.statusOverride = null;
        worker.statusOverrideReason = null;
      }
      const progress = Math.max(0, Math.min(1, (now - startedAt) / durationMs));
      worker.heartRate = Math.round(startHeartRate + (targetHeartRate - startHeartRate) * progress);
      if (progress === 1) {
        if (worker.dangerTransition) {
          worker.dangerTransition = null;
          worker.statusOverride = 'danger';
          worker.statusOverrideReason = '위험 상태 · 낮은 심박수';
        }
        worker.recoveryTransition = null;
      }
    } else if (worker.timedDanger) {
      worker.heartRate = Math.max(38, Math.min(44, worker.heartRate + randomDelta()));
    } else if (!worker.liveTelemetry) {
      const noise = (Math.random() + Math.random() + Math.random() - 1.5) * 5.5;
      worker.heartRate = Math.max(65, Math.min(88, Math.round(worker.heartRate + (worker.restingHeartRate - worker.heartRate) * 0.18 + noise)));
      if (Math.random() < 0.25) worker.spo2 = Math.max(96, Math.min(99, worker.spo2 + randomDelta()));
    }
    worker.history = [...worker.history.slice(-29), worker.heartRate];
    createAlert(worker, currentAssessment(worker));
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
  worker.statusOverride = null;
  worker.statusOverrideReason = null;
  worker.dangerTransition = null;
  worker.recoveryTransition = null;
  worker.timedDanger = false;
  worker.liveTelemetry = true;
  clearTimeout(dangerTimers.get(worker.id));
  dangerTimers.delete(worker.id);
  if (imu?.accelerometer && imu?.gyroscope) worker.imu = analyzeImu(imu);
  worker.wifi = { ...worker.wifi, connected: true, rssi: rssi ?? worker.wifi.rssi };
  worker.history = [...worker.history.slice(-29), heartRate];
  const assessment = assess(worker); createAlert(worker, assessment);
  res.json({ ok: true, deviceName: worker.deviceName, assessment });
});

app.delete('/api/alerts/:id', (req, res) => {
  const index = alerts.findIndex((item) => item.id === req.params.id);
  if (index < 0) return res.status(404).json({ message: '알림을 찾을 수 없습니다.' });
  const [deleted] = alerts.splice(index, 1);
  res.json({ ok: true, id: deleted.id });
});

app.post('/api/settings/timed-danger', (req, res) => {
  const { workerId, seconds, rampSeconds = 8 } = req.body;
  const worker = workers.find((item) => item.id === workerId);
  if (!worker) return res.status(404).json({ message: '작업자를 찾을 수 없습니다.' });
  if (!Number.isInteger(seconds) || seconds < 1 || seconds > 86400) return res.status(400).json({ message: '초는 1초 이상 86400초 이하로 입력하세요.' });
  if (!Number.isInteger(rampSeconds) || rampSeconds < 5 || rampSeconds > 30) return res.status(400).json({ message: 'BPM 하강 속도는 5초에서 30초 사이로 입력하세요.' });
  clearTimeout(dangerTimers.get(workerId));
  const timer = setTimeout(() => {
    worker.timedDanger = true;
    worker.statusOverride = 'normal';
    worker.statusOverrideReason = '설정한 위험 단계 대기 중';
    worker.recoveryTransition = null;
    worker.dangerTransition = { startedAt: Date.now() + 3000, durationMs: rampSeconds * 1000, startHeartRate: worker.heartRate, targetHeartRate: 42 };
    dangerTimers.delete(workerId);
  }, seconds * 1000);
  dangerTimers.set(workerId, timer);
  res.json({ ok: true, workerId, seconds, rampSeconds });
});

app.post('/api/settings/reset-normal', (req, res) => {
  const { workerId } = req.body;
  const worker = workers.find((item) => item.id === workerId);
  if (!worker) return res.status(404).json({ message: '작업자를 찾을 수 없습니다.' });
  clearTimeout(dangerTimers.get(workerId));
  dangerTimers.delete(workerId);
  worker.dangerTransition = null;
  worker.timedDanger = false;
  worker.statusOverride = null;
  worker.statusOverrideReason = null;
  worker.recoveryTransition = !worker.liveTelemetry && (worker.heartRate < 65 || worker.heartRate > 88)
    ? { startedAt: Date.now(), durationMs: 15000, startHeartRate: worker.heartRate, targetHeartRate: 72 }
    : null;
  if (!worker.liveTelemetry && !worker.recoveryTransition) {
    worker.statusOverride = 'normal';
    worker.statusOverrideReason = '정상으로 복귀했습니다.';
  }
  res.json({ ok: true, worker: decorate(worker) });
});

app.post('/api/workers/:id/danger-button', (req, res) => {
  const worker = workers.find((item) => item.id === req.params.id);
  if (!worker) return res.status(404).json({ message: '작업자를 찾을 수 없습니다.' });
  const alert = {
    id: crypto.randomUUID(), workerId: worker.id, workerName: worker.name, area: worker.area,
    level: 'danger', message: '위험 버튼이 눌렸습니다. 주변 작업자의 도움이 필요합니다.',
    createdAt: new Date().toISOString(), acknowledged: false, type: 'manual-danger-button',
  };
  alerts.unshift(alert);
  if (alerts.length > 30) alerts.length = 30;
  res.status(201).json({ ok: true, alert });
});

app.listen(port, host, () => console.log(`SAFE API listening on http://${host}:${port}`));
