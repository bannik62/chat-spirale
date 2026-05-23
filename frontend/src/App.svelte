<script>
  import LoginPage from './pages/Login.svelte';
  import MyActivities from './pages/MyActivities.svelte';
  import RoomChat from './pages/RoomChat.svelte';
  import AdminPage from './pages/Admin.svelte';

  function getRoute() {
    const path = window.location.pathname;
    if (path.startsWith('/admin')) return 'admin';
    if (path.startsWith('/salon/')) return 'room';
    if (path === '/mes-activites') return 'activities';
    return 'login';
  }

  let route = $state(getRoute());

  $effect(() => {
    const onNav = () => {
      route = getRoute();
    };
    window.addEventListener('popstate', onNav);
    return () => window.removeEventListener('popstate', onNav);
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
