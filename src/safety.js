import { SAFETY_THRESHOLDS, STATUS, STATUS_META } from './config.js';

export function assessWorker(reading) {
  const { heartRate, motion, fallDetected, deviceConnected, noMotionSeconds = 0 } = reading;
  if (!deviceConnected) return { status: STATUS.OFFLINE, reason: '안전모 연결 끊김' };
  if (fallDetected) return { status: STATUS.DANGER, reason: '낙상 의심 감지' };
  if (motion === 'none' && noMotionSeconds >= SAFETY_THRESHOLDS.noMotionDangerSeconds) return { status: STATUS.DANGER, reason: `움직임 없음 ${noMotionSeconds}초` };
  if (heartRate > SAFETY_THRESHOLDS.warningMax) return { status: STATUS.DANGER, reason: '심박수 위험 수치' };
  if (heartRate > SAFETY_THRESHOLDS.heartRate.normalMax || heartRate < SAFETY_THRESHOLDS.heartRate.normalMin || motion === 'sudden') return { status: STATUS.WARNING, reason: motion === 'sudden' ? '급격한 움직임 감지' : '심박수 상승' };
  return { status: STATUS.NORMAL, reason: '안정적인 작업 상태' };
}

export function decorateWorker(worker) { const assessment = assessWorker(worker); return { ...worker, ...assessment, statusMeta: STATUS_META[assessment.status] }; }
export function motionLabel(motion) { return ({ normal: '정상 활동', sudden: '급격한 움직임', none: '움직임 없음' })[motion] ?? '상태 확인 중'; }
