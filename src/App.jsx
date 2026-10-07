import { useEffect, useMemo, useState } from 'react';
import { api } from './api.js';

const labels = { normal: '정상', warning: '주의', danger: '위험', offline: '오프라인' };
const order = { danger: 0, warning: 1, offline: 2, normal: 3 };
const Status = ({ value }) => <span className={`status ${value}`}><i />{labels[value]}</span>;

function MiniChart({ values = [] }) {
  if (values.length < 2) return null;
  const points = values.map((v, i) => `${i / (values.length - 1) * 300},${90 - (v - 45) / 105 * 80}`).join(' ');
  return <svg className="chart" viewBox="0 0 300 90" preserveAspectRatio="none"><line x1="0" y1="27" x2="300" y2="27" /><polyline points={points} /></svg>;
}

function WorkerCard({ worker, onClick }) {
  return <button className={`worker-card ${worker.status}`} onClick={onClick}>
    <div className="row"><span className="eyebrow">작업자 #{worker.number}</span><Status value={worker.status} /></div>
    <h3>{worker.name}</h3><p className="muted">{worker.area}</p>
    <div className="readings"><div><strong>{worker.heartRate ?? '--'}</strong><small>BPM</small><span>심박수</span></div><div><strong>{worker.spo2 ?? '--'}</strong><small>%</small><span>산소포화도</span></div></div>
    <div className="quality"><span>신호 품질</span><b>{worker.signalQuality}%</b><progress value={worker.signalQuality} max="100" /></div>
    <div className="imu-strip"><span>중력가속도 {worker.imu.accelerationG.toFixed(2)}g</span><span>기울기 {worker.imu.tiltAngle.toFixed(0)}°</span><b>{worker.imu.fallDetected ? '넘어짐 감지' : '동작 정상'}</b></div>
    <div className="reason">{worker.reason}</div>
    <footer><span>MAX30102 · RSSI {worker.wifi.rssi} dBm</span><span>{worker.updatedAgo}초 전</span></footer>
  </button>;
}

function Detail({ worker, onClose }) {
  if (!worker) return null;
  return <><div className="backdrop" onClick={onClose} /><aside className="drawer">
    <div className="row"><div><span className="eyebrow">MAX30102 실시간 측정</span><h2>{worker.name}</h2><p className="muted">{worker.area} · {worker.deviceName}</p></div><button className="icon-button" onClick={onClose}>×</button></div>
    <div className={`detail-state ${worker.status}`}><Status value={worker.status} /><strong>{worker.reason}</strong></div>
    <div className="detail-grid"><div><span>심박수</span><b>{worker.heartRate ?? '--'} BPM</b></div><div><span>SpO₂</span><b>{worker.spo2 ?? '--'}%</b></div><div><span>합성 중력가속도</span><b>{worker.imu.accelerationG.toFixed(2)} g</b></div><div><span>합성 각속도</span><b>{worker.imu.gyroMagnitude.toFixed(1)} °/s</b></div><div><span>자세 기울기</span><b>{worker.imu.tiltAngle.toFixed(1)}°</b></div><div><span>충격 / 무동작</span><b>{worker.imu.impactDetected ? '감지' : '없음'} / {(worker.imu.stillnessMs / 1000).toFixed(1)}초</b></div><div><span>중력가속도 X/Y/Z</span><b>{worker.imu.accelerometer.x.toFixed(2)} / {worker.imu.accelerometer.y.toFixed(2)} / {worker.imu.accelerometer.z.toFixed(2)} g</b></div><div><span>각속도 X/Y/Z</span><b>{worker.imu.gyroscope.x.toFixed(0)} / {worker.imu.gyroscope.y.toFixed(0)} / {worker.imu.gyroscope.z.toFixed(0)} °/s</b></div><div><span>센서 접촉</span><b>{worker.fingerDetected ? '양호' : '미감지'}</b></div><div><span>Wi-Fi</span><b>{worker.wifi.connected ? `${worker.wifi.ssid} (${worker.wifi.rssi} dBm)` : '연결 끊김'}</b></div></div>
    <section className="chart-panel"><div className="row"><h3>최근 심박 추이</h3><small>위험 기준 120 BPM</small></div><MiniChart values={worker.history} /></section>
    <p className="notice">g는 지구의 중력가속도(1g ≈ 9.81m/s²)를 뜻합니다. 낙상은 2.5g 이상 충격, 60° 이상 기울기, 충격 후 2초 이상 무동작을 함께 판정합니다.</p>
  </aside></>;
}

export default function App() {
  const [data, setData] = useState({ workers: [], alerts: [], summary: {} });
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [devicesOpen, setDevicesOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState('dashboard');
  const load = async () => { try { setData(await api.dashboard()); setError(''); } catch { setError('백엔드 연결 실패'); } };
  useEffect(() => { load(); const timer = setInterval(load, 2500); return () => clearInterval(timer); }, []);
  const visible = useMemo(() => data.workers.filter((w) => (filter === 'all' || w.status === filter) && `${w.name} ${w.number} ${w.area}`.toLowerCase().includes(query.toLowerCase())).sort((a,b) => order[a.status] - order[b.status]), [data.workers, filter, query]);
  const selected = data.workers.find((w) => w.id === selectedId);
  const simulate = async (scenario) => { await api.simulate(scenario); await load(); };
  const acknowledge = async (id) => { await api.acknowledge(id); await load(); };
  const goTo = (menu) => {
    setActiveMenu(menu);
    if (menu === 'alerts') return setAlertsOpen(true);
    if (menu === 'devices') return setDevicesOpen(true);
    if (menu === 'workers') setFilter('all');
    document.getElementById(menu === 'workers' ? 'workers-section' : 'dashboard-top')?.scrollIntoView({ behavior: 'smooth' });
  };

  return <div className="app-shell">
    <aside className="sidebar"><div className="brand"><span>＋</span><div><b>SAFE</b><small>작업자 생체신호 관제</small></div></div><nav><button className={activeMenu === 'dashboard' ? 'active' : ''} onClick={() => goTo('dashboard')}>대시보드</button><button className={activeMenu === 'workers' ? 'active' : ''} onClick={() => goTo('workers')}>작업자 현황</button><button className={activeMenu === 'alerts' ? 'active' : ''} onClick={() => goTo('alerts')}>알림 기록</button><button className={activeMenu === 'devices' ? 'active' : ''} onClick={() => goTo('devices')}>장치 관리</button></nav><div className="side-info"><span className="online-dot" />서버 정상 작동<small>MAX30102 + 6축 IMU</small></div></aside>
    <div className="content"><header><div><h1>안전 관제 대시보드</h1><p>MAX30102 기반 실시간 생체신호 모니터링</p></div><div className="header-actions"><span className={error ? 'connection error' : 'connection'}>{error || 'Wi-Fi 게이트웨이 연결됨'}</span><button className="alert-button" onClick={() => setAlertsOpen(true)}>알림 <b>{data.summary.unacknowledged || 0}</b></button><span className="admin">관리자</span></div></header>
      <main id="dashboard-top">
        {(data.summary.danger || 0) > 0 && <div className="emergency"><b>긴급 위험 신호 감지</b><span>즉시 작업자 상태와 현장을 확인하세요.</span><button onClick={() => setAlertsOpen(true)}>알림 확인</button></div>}
        <section className="hero"><div><span className="eyebrow">LIVE MONITORING</span><h2>오늘도 모두 안전하게.</h2><p>MAX30102 + 6축 IMU 데이터는 2.5초마다 갱신됩니다.</p></div><div className="scenarios"><span>더미 시나리오</span><button onClick={() => simulate('normal')}>정상화</button><button onClick={() => simulate('fall')}>넘어짐</button><button onClick={() => simulate('hypoxia')}>저산소</button><button onClick={() => simulate('tachycardia')}>빈맥</button><button onClick={() => simulate('offline')}>연결 끊김</button></div></section>
        <section className="summary">{[['all','전체 작업자'],['normal','정상'],['warning','주의'],['danger','위험'],['offline','오프라인']].map(([key, label]) => <button className={filter === key ? `active ${key}` : key} onClick={() => setFilter(key)} key={key}><span>{label}</span><b>{data.summary[key] || 0}</b></button>)}</section>
        <div className="toolbar" id="workers-section"><div><h2>작업자 현황</h2><span>{visible.length}명 표시 중</span></div><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="이름, 번호, 작업 구역 검색" /></div>
        <section className="workers">{visible.map((worker) => <WorkerCard key={worker.id} worker={worker} onClick={() => setSelectedId(worker.id)} />)}</section>
      </main>
    </div>
    {alertsOpen && <><div className="backdrop" onClick={() => setAlertsOpen(false)} /><aside className="alerts-drawer"><div className="row"><div><span className="eyebrow">ADMIN NOTIFICATIONS</span><h2>관리자 알림</h2></div><button className="icon-button" onClick={() => setAlertsOpen(false)}>×</button></div>{data.alerts.length ? data.alerts.map((alert) => <article className={`alert-item ${alert.level}`} key={alert.id}><div className="row"><Status value={alert.level} /><time>{new Date(alert.createdAt).toLocaleTimeString('ko-KR')}</time></div><h3>{alert.workerName} · {alert.message}</h3><p>{alert.area}</p>{alert.acknowledged ? <span className="acknowledged">확인 완료</span> : <button onClick={() => acknowledge(alert.id)}>관리자 확인</button>}</article>) : <p className="empty">발생한 알림이 없습니다.</p>}</aside></>}
    {devicesOpen && <><div className="backdrop" onClick={() => setDevicesOpen(false)} /><aside className="alerts-drawer"><div className="row"><div><span className="eyebrow">CONNECTED DEVICES</span><h2>장치 관리</h2></div><button className="icon-button" onClick={() => setDevicesOpen(false)}>×</button></div>{data.workers.map((worker) => <article className="device-item" key={worker.deviceName}><div><b>{worker.deviceName}</b><span>{worker.name} · {worker.area}</span><small>내부 ID: {worker.deviceId}</small></div><div><Status value={worker.wifi.connected ? 'normal' : 'offline'} /><small>RSSI {worker.wifi.rssi} dBm</small></div></article>)}</aside></>}
    <Detail worker={selected} onClose={() => setSelectedId(null)} />
  </div>;
}
