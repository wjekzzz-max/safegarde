const request = async (path, options) => {
  const response = await fetch(`/api${path}`, { headers: { 'Content-Type': 'application/json' }, ...options });
  if (!response.ok) throw new Error((await response.json()).message || '요청에 실패했습니다.');
  return response.json();
};
export const api = {
  dashboard: () => request('/dashboard'),
  scheduleDanger: (workerId, seconds, rampSeconds) => request('/settings/timed-danger', { method: 'POST', body: JSON.stringify({ workerId, seconds, rampSeconds }) }),
  resetWorker: (workerId) => request('/settings/reset-normal', { method: 'POST', body: JSON.stringify({ workerId }) }),
  dangerButton: (workerId) => request(`/workers/${workerId}/danger-button`, { method: 'POST' }),
  deleteAlert: (id) => request(`/alerts/${id}`, { method: 'DELETE' }),
};
