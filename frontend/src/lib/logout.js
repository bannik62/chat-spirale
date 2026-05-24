import { sessionFetch, setAdminToken } from './api.js';
import { logAction } from './debugLog.js';
import { navigate } from './navigate.js';

/** Déconnexion participant + admin, puis retour à la page de connexion. */
export async function logoutToLogin({ replace = false } = {}) {
  logAction('Auth', 'logout');
  setAdminToken(null);
  try {
    await sessionFetch('/logout', { method: 'POST' });
  } catch {
    /* cookie déjà absent */
  }
  navigate('/', { replace });
}
