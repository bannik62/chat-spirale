import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

const isProd = process.env.NODE_ENV === 'production';

function parseRateLimitMax(envValue, fallbackProd, fallbackDev) {
  const n = Number(envValue);
  if (Number.isFinite(n) && n > 0) return Math.floor(n);
  return isProd ? fallbackProd : fallbackDev;
}

/** Origines autorisées (CORS + Socket.IO). */
export function getAllowedOrigins() {
  const origins = new Set();
  const main = process.env.FRONTEND_URL?.replace(/\/$/, '');
  if (main) origins.add(main);

  const extra = process.env.CORS_EXTRA_ORIGINS || '';
  for (const o of extra.split(',').map((s) => s.trim()).filter(Boolean)) {
    origins.add(o.replace(/\/$/, ''));
  }

  if (!isProd) {
    origins.add('http://localhost:8081');
    origins.add('http://localhost:5174');
    origins.add('http://127.0.0.1:8081');
    origins.add('http://127.0.0.1:5174');
  }

  return [...origins];
}

export function corsOriginValidator(origin, callback) {
  if (!origin) {
    callback(null, true);
    return;
  }
  const allowed = getAllowedOrigins();
  if (allowed.includes(origin.replace(/\/$/, ''))) {
    callback(null, true);
    return;
  }
  callback(new Error(`CORS refusé: ${origin}`));
}

export const securityHeaders = helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'same-site' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  hsts: isProd
    ? { maxAge: 31536000, includeSubDomains: true, preload: false }
    : false,
});

/** Anti brute-force — uniquement POST login (portal-login, login). */
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseRateLimitMax(process.env.AUTH_RATE_LIMIT_MAX, 100, 100),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives. Réessayez dans 15 minutes.' },
  skip: () => !isProd && process.env.RATE_LIMIT_OFF === '1',
});

/** @deprecated Utiliser loginRateLimiter sur les routes POST login uniquement. */
export const authRateLimiter = loginRateLimiter;

/** Limite générale API */
export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isProd ? 200 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de requêtes. Réessayez plus tard.' },
  skip: () => !isProd && process.env.RATE_LIMIT_OFF === '1',
});

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'strict' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
}

export function adminCookieOptions() {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'strict' : 'lax',
    maxAge: 8 * 60 * 60 * 1000,
  };
}
