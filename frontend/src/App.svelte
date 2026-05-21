<script>
  import AdminPage from './pages/Admin.svelte';
  import ChatPage from './pages/Chat.svelte';

  function getRoute() {
    const path = window.location.pathname;
    if (path.startsWith('/chat')) return 'chat';
    if (path.startsWith('/admin')) return 'admin';
    return 'home';
  }

  let route = $state(getRoute());

  $effect(() => {
    const onNav = () => {
      route = getRoute();
    };
    window.addEventListener('popstate', onNav);
    return () => window.removeEventListener('popstate', onNav);
  });

  function navigate(path) {
    history.pushState({}, '', path);
    route = getRoute();
  }
</script>

{#if route === 'chat'}
  <ChatPage />
{:else if route === 'admin'}
  <AdminPage />
{:else}
  <main class="home">
    <div class="hero">
      <p class="badge">Association Spirale</p>
      <h1>Espace de communication</h1>
      <p class="lead">
        Chats par groupe, accès par invitation email, renouvellement hebdomadaire.
      </p>
      <div class="actions">
        <button class="primary" onclick={() => navigate('/admin')}>Administration</button>
        <p class="hint">Les participants rejoignent via le lien reçu par email.</p>
      </div>
    </div>
  </main>
{/if}

<style>
  .home {
    min-height: 100vh;
    display: grid;
    place-items: center;
    padding: 2rem;
    background:
      radial-gradient(ellipse 80% 50% at 50% -20%, rgba(107, 76, 230, 0.25), transparent),
      var(--bg);
  }

  .hero {
    max-width: 480px;
    text-align: center;
  }

  .badge {
    display: inline-block;
    margin: 0 0 1rem;
    padding: 0.35rem 0.75rem;
    border-radius: 999px;
    background: var(--surface);
    color: var(--muted);
    font-size: 0.85rem;
  }

  h1 {
    margin: 0 0 0.75rem;
    font-size: 2rem;
    font-weight: 700;
  }

  .lead {
    color: var(--muted);
    line-height: 1.6;
    margin-bottom: 2rem;
  }

  .actions {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    align-items: center;
  }

  .primary {
    padding: 0.85rem 2rem;
    background: var(--accent);
    color: white;
    border: none;
    border-radius: 8px;
    font-weight: 600;
  }

  .primary:hover {
    background: var(--accent-hover);
  }

  .hint {
    font-size: 0.85rem;
    color: var(--muted);
    margin: 0;
  }
</style>
