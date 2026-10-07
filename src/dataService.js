export class WorkerDataService {
  constructor(workers, onUpdate) { this.workers = workers; this.onUpdate = onUpdate; }
  startMockStream() { setInterval(() => { this.workers = this.workers.map((worker) => { if (worker.id === 'W04') return { ...worker, updatedAgo: 1 }; const delta = Math.floor(Math.random() * 5) - 2; const monitored = ['W03', 'W07', 'W09'].includes(worker.id); const heartRate = Math.max(monitored ? 102 : 58, Math.min(monitored ? 116 : 96, worker.heartRate + delta)); return { ...worker, heartRate, updatedAgo: 1, history: [...worker.history.slice(-6), heartRate] }; }); this.onUpdate(this.workers); }, 3000); }
}
