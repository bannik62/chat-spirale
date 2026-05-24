const API = '/api';

import { logApi, logApiOk, logApiErr } from './debugLog.js';

const ADMIN_TOKEN_KEY = 'admin_token';

/** Token admin isolé par onglet (sessionStorage, pas localStorage). */
export function getAdminToken() {
  try {
    const token = sessionStorage.getItem(ADMIN_TOKEN_KEY);
    if (token) return token;
    // Migration one-shot depuis l’ancien stockage partagé
    const legacy = localStorage.getItem(ADMIN_TOKEN_KEY);
    if (legacy) {
      sessionStorage.setItem(ADMIN_TOKEN_KEY, legacy);
      localStorage.removeItem(ADMIN_TOKEN_KEY);
      return legacy;
    }
  } catch {
    /* private mode */
  }
  return null;
}

export function setAdminToken(token) {
  try {
    if (token) sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
    else sessionStorage.removeItem(ADMIN_TOKEN_KEY);
    localStorage.removeItem(ADMIN_TOKEN_KEY);
  } catch {
    /* ignore */
  }
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

/** Session cookies uniquement — pas de Bearer admin (évite la fuite cross-onglet). */
export async function sessionFetch(path, options = {}) {
  const method = options.method || 'GET';
  const body = options.body ? JSON.parse(options.body) : undefined;
  logApi(method, `/auth${path}`, body);

  const res = await fetch(`${API}/auth${path}`, {
    credentials: 'include',
    ...options,
    headers: {
      'Content-Type': 'application/json',
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

/** Session avec Bearer admin si présent dans cet onglet (page admin / login formateur). */
export async function adminSessionFetch(path, options = {}) {
  const method = options.method || 'GET';
  const body = options.body ? JSON.parse(options.body) : undefined;
  logApi(method, `/auth${path}`, body);

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  const token = getAdminToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API}/auth${path}`, {
    credentials: 'include',
    ...options,
    headers,
  });
  const data = await parseResponse(res);

  if (!res.ok) {
    logApiErr(method, `/auth${path}`, data.error || res.statusText);
    throw new Error(data.error || res.statusText);
  }

  logApiOk(method, `/auth${path}`, data);
  return data;
}

/** @deprecated Préférer sessionFetch ou adminSessionFetch selon le contexte. */
export async function authFetch(path, options = {}) {
  return sessionFetch(path, options);
}

/** Contexte salon : participant (cookie) + isFormateur (admin validé dans cet onglet). */
export async function fetchRoomContext() {
  logApi('GET', '/auth/room-context');
  const headers = { 'Content-Type': 'application/json' };
  const token = getAdminToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API}/auth/room-context`, {
    credentials: 'include',
    headers,
  });
  const data = await parseResponse(res);

  if (res.status === 404) {
    logApiErr('GET', '/auth/room-context', 'Route absente — redémarrez le backend');
    return { email: '', isFormateur: false, _legacyBackend: true };
  }

  if (!res.ok) {
    logApiErr('GET', '/auth/room-context', data.error || res.statusText);
    throw new Error(data.error || res.statusText);
  }

  logApiOk('GET', '/auth/room-context', { isFormateur: data.isFormateur });
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
