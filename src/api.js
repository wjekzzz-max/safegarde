const request = async (path, options) => {
  const response = await fetch(`/api${path}`, { headers: { 'Content-Type': 'application/json' }, ...options });
  if (!response.ok) throw new Error((await response.json()).message || '요청에 실패했습니다.');
  return response.json();
};
export const api = {
  dashboard: () => request('/dashboard'),
  acknowledge: (id) => request(`/alerts/${id}/acknowledge`, { method: 'PATCH' }),
  simulate: (scenario) => request('/simulation', { method: 'POST', body: JSON.stringify({ scenario }) }),
};
