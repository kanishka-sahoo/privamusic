// Thin JSON client for the dashboard API. Every failure becomes an Error with the server's message.
export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(path, options = {}) {
  const response = await fetch(path, {...options, headers: {'Content-Type': 'application/json'}});
  const data = await response.json();
  if (!response.ok) throw new ApiError(data.error || 'Request failed', response.status);
  return data;
}

export const api = {
  state: () => request('/api/state'),
  login: (credentials) => request('/api/login', {method: 'POST', body: JSON.stringify(credentials)}),
  logout: () => request('/api/logout', {method: 'POST', body: '{}'}),
  addJob: (url) => request('/api/jobs', {method: 'POST', body: JSON.stringify({url})}),
  jobAction: (id, action) => request(`/api/jobs/${id}/${action}`, {method: 'POST', body: '{}'}),
};
