const PREFIX = '[Spirale]';

/** Masque les champs sensibles avant affichage console. */
function sanitize(data) {
  if (data == null || typeof data !== 'object') return data;
  if (Array.isArray(data)) return data.map(sanitize);
  const out = { ...data };
  for (const key of Object.keys(out)) {
    const k = key.toLowerCase();
    if (k.includes('password') || k.includes('pass') || k === 'code' || k === 'token') {
      out[key] = '***';
    } else if (typeof out[key] === 'object') {
      out[key] = sanitize(out[key]);
    }
  }
  return out;
}

/** Action utilisateur (clic, submit, navigation). */
export function logAction(page, action, detail) {
  if (detail !== undefined) {
    console.log(`${PREFIX} [${page}] ${action}`, sanitize(detail));
  } else {
    console.log(`${PREFIX} [${page}] ${action}`);
  }
}

/** Appel API sortant. */
export function logApi(method, path, detail) {
  console.log(`${PREFIX} [API] → ${method} ${path}`, detail ? sanitize(detail) : '');
}

/** Réponse API. */
export function logApiOk(method, path, detail) {
  console.log(`${PREFIX} [API] ✓ ${method} ${path}`, detail ? sanitize(detail) : '');
}

export function logApiErr(method, path, err) {
  console.warn(`${PREFIX} [API] ✗ ${method} ${path}`, err?.message || err);
}

/** Erreur action UI. */
export function logError(page, action, err) {
  console.warn(`${PREFIX} [${page}] ${action} — erreur`, err?.message || err);
}
