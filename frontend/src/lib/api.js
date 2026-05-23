const API = '/api';

import { logApi, logApiOk, logApiErr } from './debugLog.js';

export function getAdminToken() {
  return localStorage.getItem('admin_token');
}

export function setAdminToken(token) {
  if (token) localStorage.setItem('admin_token', token);
  else localStorage.removeItem('admin_token');
}

async function parseResponse(res) {
  const data = await res.json().catch(() => ({}));
  return data;
}

export async function adminFetch(path, options = {}) {
  const method = options.method || 'GET';
  const body = options.body ? JSON.parse(options.body) : undefined;
  logApi(method, `/admin${path}`, body);

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  const token = getAdminToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API}/admin${path}`, {
    credentials: 'include',
    ...options,
    headers,
  });
  const data = await parseResponse(res);

  if (res.status === 401) {
    logApiErr(method, `/admin${path}`, 'Session expirée (401)');
    setAdminToken(null);
    throw new Error('Session expirée');
  }
  if (!res.ok) {
    logApiErr(method, `/admin${path}`, data.error || res.statusText);
    throw new Error(data.error || res.statusText);
  }

  logApiOk(method, `/admin${path}`, data);
  return data;
}

export async function authFetch(path, options = {}) {
  const method = options.method || 'GET';
  const body = options.body ? JSON.parse(options.body) : undefined;
  logApi(method, `/auth${path}`, body);

  const token = getAdminToken();
  const res = await fetch(`${API}/auth${path}`, {
    credentials: 'include',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await parseResponse(res);

  if (!res.ok) {
    logApiErr(method, `/auth${path}`, data.error || res.statusText);
    throw new Error(data.error || res.statusText);
  }

  logApiOk(method, `/auth${path}`, data);
  return data;
}

export async function roomFetch(roomId, path, options = {}) {
  const method = options.method || 'GET';
  const body = options.body ? JSON.parse(options.body) : undefined;
  logApi(method, `/rooms/${roomId}${path}`, body);

  const res = await fetch(`${API}/rooms/${roomId}${path}`, {
    credentials: 'include',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const data = await parseResponse(res);

  if (!res.ok) {
    logApiErr(method, `/rooms/${roomId}${path}`, data.error || res.statusText);
    throw new Error(data.error || res.statusText);
  }

  logApiOk(method, `/rooms/${roomId}${path}`, data);
  return data;
}
