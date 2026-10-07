import { STATUS } from './config.js';
import { initialAlerts, initialWorkers } from './mockData.js';
import { WorkerDataService } from './dataService.js';
import { decorateWorker, motionLabel } from './safety.js';

const app = document.querySelector('#app');
let workers = initialWorkers.map(decorateWorker);
let selectedId = null, filter = 'all', query = '', area = 'all', acknowledgedOpen = false, alertsOpen = false;
const acknowledged = new Set();
let theme = localStorage.getItem('safety-theme') || 'dark';
// The root element also has data-theme. Handle the header button during capture
// and suppress the legacy root click handler that would otherwise see every click.
document.documentElement.addEventListener('click', (event) => {
  const toggle = event.target.closest('button[data-theme]');
  if (!toggle) return;
  theme = theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('safety-theme', theme);
  render();
  event.stopPropagation();
}, true);
document.documentElement.addEventListener('click', (event) => event.stopImmediatePropagation());
document.documentElement.addEventListener('click', (event) => {
  if (event.target.closest('[data-close-alert]')) {
    alertsOpen = false;
    render();
    event.stopPropagation();
    return;
  }
  if (!event.target.closest('[data-scroll-alerts]')) return;
  alertsOpen = true;
  render();
  document.querySelector('.alerts-panel')?.classList.add('is-open');
  if (!document.querySelector('.alert-close')) document.querySelector('.alerts-panel')?.insertAdjacentHTML('afterbegin', '<button class="alert-close" data-close-alert aria-label="위험 알림 닫기">×</button>');
  event.stopPropagation();
}, true);
document.documentElement.addEventListener('click', (event) => {
  const alertWorker = event.target.closest('.alerts-panel [data-worker]');
  if (!alertsOpen || !alertWorker) return;
  selectedId = alertWorker.dataset.worker;
  render();
  event.stopPropagation();
}, true);
const order = { danger: 0, warning: 1, normal: 2, offline: 3 };
const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c]);
const getWorker = (id) => workers.find((worker) => worker.id === id);
const pill = (w) => `<span class="pill ${w.status}">${w.statusMeta.icon} ${w.statusMeta.label}</span>`;
const visible = () => workers.filter((w) => (filter === 'all' || w.status === filter) && (area === 'all' || w.area === area) && `${w.name} ${w.id} ${w.number}`.toLowerCase().includes(query.toLowerCase())).sort((a,b) => order[a.status] - order[b.status] || a.number.localeCompare(b.number));
const confidence = (w) => w.status === 'danger' ? 94 : w.status === 'warning' ? 87 : 96;
const chart = (values) => { const min=55,max=140,width=500,height=130, y=(v)=>height-(v-min)/(max-min)*height; return `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none"><line x1="0" x2="${width}" y1="62" y2="62" class="chart-limit"/><polyline points="${values.map((v,i)=>`${i/(values.length-1)*width},${y(v)}`).join(' ')}" class="chart-line"/>${values.map((v,i)=>`<circle cx="${i/(values.length-1)*width}" cy="${y(v)}" r="3" class="chart-dot"/>`).join('')}</svg>`; };

function card(w) { const fall = w.fallDetected ? 'bad' : 'good'; return `<button class="worker ${w.status}" data-worker="${w.id}"><div class="card-top"><div><span class="id">작업자 #${w.number}</span><h3>${esc(w.name)}</h3></div>${pill(w)}</div><p class="area">⌖ ${esc(w.area)}</p><div class="hr">♥ ${w.heartRate}<small>BPM</small></div><div class="facts"><div><span>움직임</span><b>${motionLabel(w.motion)}</b></div><div><span>낙상 감지</span><b class="${fall}">${w.fallDetected ? '의심 감지' : '이상 없음'}</b></div></div><div class="assessment"><small>AI 안전 판단</small><b>${w.reason}</b><span class="confidence">신뢰도 ${confidence(w)}%</span></div><div class="foot"><span>${w.updatedAgo}초 전 업데이트</span><span class="detail">상세 보기 →</span></div></button>`; }
function alertCard(a) { const w=getWorker(a.workerId); return `<button class="alert ${w.status}" data-worker="${w.id}"><div class="alert-top"><span>${a.time}</span>${pill(w)}</div><h3>${esc(w.name)} <small>(작업자 #${w.number})</small></h3><p>⌖ ${esc(w.area)}</p><strong>${w.reason}</strong><span class="open">상세 확인 →</span></button>`; }
function zones() { const zoneData=[...new Set(workers.map(w=>w.area))].slice(0,4).map((name)=>{const list=workers.filter(w=>w.area===name),n=list.filter(w=>w.status==='normal').length,w=list.filter(w=>w.status==='warning').length,d=list.filter(w=>w.status==='danger').length;return {name,n,w,d};}); return `<section class="zones"><div class="panel-head"><h2>◈ 구역별 안전 현황</h2><span class="live">실시간 반영</span></div><div class="zone-content"><div class="zone-grid">${zoneData.map(z=>`<article class="zone ${z.d?'danger':''}"><b>${esc(z.name)}</b><div class="counts"><span>정상<strong class="good">${z.n}</strong></span><span>주의<strong class="warn">${z.w}</strong></span><span>위험<strong class="bad">${z.d}</strong></span></div><div class="bar"><i style="flex:${Math.max(z.n,.25)}"></i><i class="w" style="flex:${Math.max(z.w,.25)}"></i><i class="d" style="flex:${Math.max(z.d,.25)}"></i></div></article>`).join('')}</div><div class="map"><h3>공장 구역 맵</h3><div class="map-grid">${zoneData.map(z=>`<div class="map-zone ${z.d?'danger':z.w?'warning':''}">${esc(z.name.split(' ')[0])}</div>`).join('')}</div></div></div></section>`; }
function drawer(w) { if(!w)return ''; return `<div class="backdrop" data-close></div><aside class="drawer" role="dialog" aria-modal="true" aria-label="작업자 상세정보"><div class="drawer-top"><div><span class="id">작업자 상세정보</span><h2>${esc(w.name)}</h2><p>⌖ ${esc(w.area)}</p></div><button class="close" data-close aria-label="상세정보 닫기">×</button></div><div class="drawer-status ${w.status}">${pill(w)}<b>${w.reason}</b></div><div class="metrics"><div class="metric"><span>심박수</span><b class="bad">♥ ${w.heartRate} BPM</b></div><div class="metric"><span>현재 움직임</span><b>${motionLabel(w.motion)}</b></div><div class="metric"><span>낙상 감지</span><b class="${w.fallDetected?'bad':'good'}">${w.fallDetected?'의심 감지':'이상 없음'}</b></div><div class="metric"><span>AI 신뢰도</span><b>${confidence(w)}%</b></div></div><section class="chart"><h3>실시간 심박수 · 최근 60초</h3>${chart(w.history)}</section>${w.status===STATUS.DANGER?`<div class="actions">${acknowledged.has(w.id)?'<span class="good">관리자가 위험 상황을 확인했습니다.</span>':'<button class="primary" data-ack>관리자 확인 완료</button>'}<button data-close>상태 확인</button></div>`:''}</aside>`; }
function ackModal(){if(!acknowledgedOpen)return '';const list=workers.filter(w=>acknowledged.has(w.id));return `<section class="modal"><div class="modal-head"><h2>관리자 확인 완료</h2><button class="close" data-close-ack>×</button></div>${list.length?list.map(w=>`<button class="ack-worker" data-worker="${w.id}"><span><b>${esc(w.name)}</b><small>${esc(w.area)}</small></span><span>상세 보기 →</span></button>`).join(''):'<p class="empty">확인 처리된 위험 작업자가 없습니다.</p>'}</section>`;}
function render(){document.documentElement.dataset.theme=theme;const counts={all:workers.length,normal:workers.filter(w=>w.status==='normal').length,warning:workers.filter(w=>w.status==='warning').length,danger:workers.filter(w=>w.status==='danger').length},areas=[...new Set(workers.map(w=>w.area))],alerts=[...initialAlerts].sort((a,b)=>order[getWorker(a.workerId).status]-order[getWorker(b.workerId).status]);app.innerHTML=`<div class="app"><aside class="sidebar"><div class="brand"><div class="brand-mark">◈</div><div><h1>AI 작업자 안전 관제</h1><p>실시간 작업자 상태 모니터링</p></div></div><nav class="nav">${[['⌂','대시보드'],['♧','작업자 현황'],['⚠','위험 알림'],['⌘','구역 모니터링'],['▤','작업 기록'],['⚙','설정']].map(([i,n],x)=>`<button class="${x===0?'active':''}"><i>${i}</i>${n}</button>`).join('')}</nav><div class="model"><small>AI 모델 상태</small><b>정상 작동 중</b><small>모델 신뢰도 94.6%</small><span></span></div></aside><div><header class="topbar"><button class="ack" data-ack-toggle>✓ 확인 완료${acknowledged.size?` (${acknowledged.size})`:''}</button><button class="alerts" data-scroll-alerts>△ 위험 알림 ${counts.danger}</button><div class="clock" id="clock"></div><div class="online">시스템 정상 작동 중</div><button data-theme>${theme==='dark'?'☀ 라이트 모드':'☾ 다크 모드'}</button><div class="admin">● 관리자</div></header><main class="dashboard">${counts.danger?`<section class="banner"><strong>⚠ 긴급 위험 발생</strong><p>${counts.danger}명의 작업자가 위험 상태입니다. 즉시 확인이 필요합니다.</p><button data-scroll-alerts>상세 확인 →</button></section>`:''}<div class="layout"><section><div class="heading"><div><h2>작업자 실시간 상태</h2><p>AI 안전 판단 및 생체 신호 모니터링</p></div><span class="live">실시간 갱신 중</span></div><div class="kpis">${[['전체 작업자',counts.all,'all','◉'],['정상',counts.normal,'normal','✓'],['주의',counts.warning,'warning','!'],['위험',counts.danger,'danger','⚠']].map(([n,v,t,i])=>`<article class="kpi ${t}"><span>${n}</span><b>${v}명</b><small>${(v/counts.all*100).toFixed(1)}%</small><i>${i}</i></article>`).join('')}</div><div class="controls"><label class="search">⌕ <input id="search" value="${esc(query)}" placeholder="작업자 이름 또는 ID 검색"></label><div class="filters">${[['all','전체'],['normal','정상'],['warning','주의'],['danger','위험']].map(([k,n])=>`<button class="filter ${filter===k?`active ${k}`:''}" data-filter="${k}">${n} ${counts[k]}</button>`).join('')}</div><select id="area"><option value="all">전체 구역</option>${areas.map(a=>`<option value="${esc(a)}" ${a===area?'selected':''}>${esc(a)}</option>`).join('')}</select></div><div class="workers">${visible().map(card).join('')||'<p class="empty">조건에 맞는 작업자가 없습니다.</p>'}</div></section><aside class="alerts-panel" id="alerts"><div class="panel-head"><h2>⚠ 실시간 위험 알림</h2><span class="badge">${alerts.length}</span></div><div class="alerts-list">${alerts.map(alertCard).join('')}</div><button class="all-alerts" data-scroll-alerts>모든 알림 보기 →</button></aside>${zones()}</div></main></div></div>${drawer(getWorker(selectedId))}${ackModal()}`;clock();bind();}
function clock(){const el=document.querySelector('#clock');if(el)el.textContent=new Intl.DateTimeFormat('ko-KR',{dateStyle:'medium',timeStyle:'medium',hour12:false}).format(new Date());}
function grid(){const el=document.querySelector('.workers');if(!el)return;el.innerHTML=visible().map(card).join('')||'<p class="empty">조건에 맞는 작업자가 없습니다.</p>';el.querySelectorAll('[data-worker]').forEach(b=>b.onclick=()=>{selectedId=b.dataset.worker;render();});}
function bind(){const search=document.querySelector('#search');search?.addEventListener('input',e=>{query=e.target.value;if(!e.isComposing)grid();});search?.addEventListener('compositionend',e=>{query=e.target.value;grid();});document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;render();});document.querySelector('#area')?.addEventListener('change',e=>{area=e.target.value;render();});document.querySelectorAll('[data-worker]').forEach(b=>b.onclick=()=>{selectedId=b.dataset.worker;render();});document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>{selectedId=null;render();});document.querySelector('[data-ack]')?.addEventListener('click',()=>{acknowledged.add(selectedId);render();});document.querySelector('[data-ack-toggle]')?.addEventListener('click',()=>{acknowledgedOpen=!acknowledgedOpen;render();});document.querySelector('[data-close-ack]')?.addEventListener('click',()=>{acknowledgedOpen=false;render();});document.querySelectorAll('[data-scroll-alerts]').forEach(b=>b.onclick=()=>document.querySelector('#alerts')?.scrollIntoView({behavior:'smooth'}));document.querySelector('[data-theme]')?.addEventListener('click',()=>{theme=theme==='dark'?'light':'dark';localStorage.setItem('safety-theme',theme);render();});}
function renderWithFocus(){const input=document.querySelector('#search'),active=document.activeElement===input,start=input?.selectionStart,end=input?.selectionEnd;render();if(active){const next=document.querySelector('#search');next?.focus();next?.setSelectionRange(start,end);}}
{
function zones() { const zoneData = [...new Set(workers.map((worker) => worker.area))].map((name) => { const list = workers.filter((worker) => worker.area === name), normal = list.filter((worker) => worker.status === 'normal').length, warning = list.filter((worker) => worker.status === 'warning').length, danger = list.filter((worker) => worker.status === 'danger').length; return { name, normal, warning, danger }; }); return `<section class="zones"><div class="panel-head"><h2>◈ 구역별 안전 현황</h2><span class="live">실시간 반영</span></div><div class="zone-content"><div class="zone-grid">${zoneData.map((zone) => `<article class="zone ${zone.danger ? 'danger' : ''}"><b>${esc(zone.name)}</b><div class="counts"><span>정상<strong class="good">${zone.normal}</strong></span><span>주의<strong class="warn">${zone.warning}</strong></span><span>위험<strong class="bad">${zone.danger}</strong></span></div><div class="bar"><i style="flex:${Math.max(zone.normal, .25)}"></i><i class="w" style="flex:${Math.max(zone.warning, .25)}"></i><i class="d" style="flex:${Math.max(zone.danger, .25)}"></i></div></article>`).join('')}</div><div class="map"><h3>공장 구역 맵</h3><div class="map-grid">${zoneData.map((zone) => `<div class="map-zone ${zone.danger ? 'danger' : zone.warning ? 'warning' : ''}">${esc(zone.name.split(' ')[0])}</div>`).join('')}</div></div></div></section>`; }

}
zones = () => { const data = [...new Set(workers.map((worker) => worker.area))].map((name) => { const members = workers.filter((worker) => worker.area === name); return { name, normal: members.filter((worker) => worker.status === 'normal').length, warning: members.filter((worker) => worker.status === 'warning').length, danger: members.filter((worker) => worker.status === 'danger').length }; }); const zoneCard = (zone) => `<article class="zone ${zone.danger ? 'danger' : ''}"><b>${esc(zone.name)}</b><div class="counts"><span>정상<strong class="good">${zone.normal}</strong></span><span>주의<strong class="warn">${zone.warning}</strong></span><span>위험<strong class="bad">${zone.danger}</strong></span></div><div class="bar"><i style="flex:${Math.max(zone.normal, .25)}"></i><i class="w" style="flex:${Math.max(zone.warning, .25)}"></i><i class="d" style="flex:${Math.max(zone.danger, .25)}"></i></div></article>`; return `<section class="zones"><div class="panel-head"><h2>◈ 구역별 안전 현황</h2><span class="live">실시간 반영</span></div><div class="zone-content"><div class="zone-grid">${data.map(zoneCard).join('')}</div><div class="map"><h3>공장 구역 맵</h3><div class="map-grid">${data.map((zone) => `<div class="map-zone ${zone.danger ? 'danger' : zone.warning ? 'warning' : ''}">${esc(zone.name.split(' ')[0])}</div>`).join('')}</div></div></div></section>`; };
clock = () => { const element = document.querySelector('#clock'); if (element) element.textContent = new Intl.DateTimeFormat('ko-KR', { dateStyle:'medium', timeStyle:'medium', hour12:false }).format(new Date()); const title = document.querySelector('.brand h1'); if (title) title.innerHTML = '작업자 위험<br>알림 시스템'; document.title = '작업자 위험 알림 시스템'; };
render();setInterval(clock,1000);new WorkerDataService(initialWorkers,next=>{workers=next.map(decorateWorker);grid();}).startMockStream();
const renderDashboard = render;
render = () => {
  renderDashboard();
  if (alertsOpen) {
    const panel = document.querySelector('.alerts-panel');
    panel?.classList.add('is-open');
    if (panel && !panel.querySelector('.alert-close')) panel.insertAdjacentHTML('afterbegin', '<button class="alert-close" data-close-alert aria-label="위험 알림 닫기">×</button>');
  }
};
let acknowledgedSeenCount = 0;
const renderWithAlertBadges = render;
render = () => {
  renderWithAlertBadges();
  const hasUnacknowledgedDanger = workers.some((worker) => worker.status === STATUS.DANGER && !acknowledged.has(worker.id));
  document.body.classList.toggle('has-unacknowledged-danger', hasUnacknowledgedDanger);
  const remainingAcknowledgements = Math.max(0, acknowledged.size - acknowledgedSeenCount);
  const acknowledgementButton = document.querySelector('[data-ack-toggle]');
  if (acknowledgementButton) acknowledgementButton.textContent = `✓ 확인 완료${remainingAcknowledgements ? ` (${remainingAcknowledgements})` : ''}`;
};
document.addEventListener('click', (event) => {
  if (event.target.closest('[data-ack-toggle]')) acknowledgedSeenCount = acknowledged.size;
}, true);
render();
