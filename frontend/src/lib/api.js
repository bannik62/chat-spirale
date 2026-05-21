const API = '/api';

export function getAdminToken() {
  return localStorage.getItem('admin_token');
}

export function setAdminToken(token) {
  if (token) localStorage.setItem('admin_token', token);
  else localStorage.removeItem('admin_token');
}

export async function adminFetch(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  const token = getAdminToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API}/admin${path}`, { ...options, headers });
  if (res.status === 401) {
    setAdminToken(null);
    throw new Error('Session expirée');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

export async function chatFetch(path, { token, ...options } = {}) {
  const url = new URL(`${API}/chat${path}`, window.location.origin);
  if (token) url.searchParams.set('token', token);

  const res = await fetch(url, {
    credentials: 'include',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'x-chat-token': token } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}
