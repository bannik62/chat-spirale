const WEAK_SECRETS = new Set([
  'change-me',
  'change-me-in-production',
  'dev-secret',
  'dev-secret-change-me',
  'secret',
]);

export function validateProductionEnv() {
  if (process.env.NODE_ENV !== 'production') return;

  const secret = process.env.JWT_SECRET || '';
  if (secret.length < 32 || WEAK_SECRETS.has(secret)) {
    console.error('[security] JWT_SECRET trop faible ou absent en production.');
    process.exit(1);
  }

  if (process.env.DEV_SEED === '1') {
    console.error('[security] DEV_SEED=1 interdit en production.');
    process.exit(1);
  }

  const url = process.env.FRONTEND_URL || '';
  if (!url.startsWith('https://')) {
    console.warn('[security] FRONTEND_URL devrait être en https:// en production.');
  }

  if (!process.env.FRONTEND_URL) {
    console.error('[security] FRONTEND_URL requis en production.');
    process.exit(1);
  }
}
