<script>
  import LoginPage from './pages/Login.svelte';
  import MyActivities from './pages/MyActivities.svelte';
  import RoomChat from './pages/RoomChat.svelte';
  import AdminPage from './pages/Admin.svelte';
  import { logAction } from './lib/debugLog.js';
  import { normalizePath } from './lib/navigate.js';

  function getRoute() {
    const path = normalizePath(window.location.pathname);
    if (path.startsWith('/admin')) return 'admin';
    if (path.startsWith('/salon/')) return 'room';
    if (path === '/mes-activites') return 'activities';
    return 'login';
  }

  let route = $state(getRoute());

  function syncRoute() {
    route = getRoute();
    logAction('App', 'navigation', { route, path: window.location.pathname });
  }

  $effect(() => {
    logAction('App', 'initial route', { route, path: window.location.pathname });

    const onPopState = () => syncRoute();

    const onClick = (e) => {
      const a = e.target.closest('a[href]');
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return;

      const href = a.getAttribute('href');
      if (!href || href.startsWith('mailto:') || href.startsWith('tel:')) return;
      if (href.startsWith('http://') || href.startsWith('https://')) return;
      if (!href.startsWith('/')) return;

      e.preventDefault();
      const target = normalizePath(href.split('?')[0]);
      const current = normalizePath(window.location.pathname);
      if (target === current) return;

      history.pushState({}, '', href);
      syncRoute();
    };

    window.addEventListener('popstate', onPopState);
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('popstate', onPopState);
      document.removeEventListener('click', onClick, true);
    };
  });
</script>

{#if route === 'room'}
  <RoomChat />
{:else if route === 'activities'}
  <MyActivities />
{:else if route === 'admin'}
  <AdminPage />
{:else}
  <LoginPage />
{/if}
