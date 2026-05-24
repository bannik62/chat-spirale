/** Normalise un chemin (sans slash final). */
export function normalizePath(pathname) {
  return pathname.replace(/\/+$/, '') || '/';
}

/** Navigation SPA — met à jour l'URL et notifie App.svelte. */
export function navigate(path, { replace = false } = {}) {
  const target = normalizePath(path.startsWith('/') ? path : `/${path}`);
  const current = normalizePath(window.location.pathname);

  if (target === current && window.location.search === '') return;

  if (replace) {
    history.replaceState({}, '', target);
  } else {
    history.pushState({}, '', target);
  }
  window.dispatchEvent(new PopStateEvent('popstate'));
}
