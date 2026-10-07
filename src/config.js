export const SAFETY_THRESHOLDS = {
  heartRate: { normalMin: 55, normalMax: 100, warningMax: 120 },
  noMotionDangerSeconds: 15,
};

export const STATUS = { NORMAL: 'normal', WARNING: 'warning', DANGER: 'danger', OFFLINE: 'offline' };

export const STATUS_META = {
  [STATUS.NORMAL]: { label: '정상', icon: '✓', className: 'normal' },
  [STATUS.WARNING]: { label: '주의', icon: '!', className: 'warning' },
  [STATUS.DANGER]: { label: '위험', icon: '!', className: 'danger' },
  [STATUS.OFFLINE]: { label: '연결 끊김', icon: '×', className: 'offline' },
};
