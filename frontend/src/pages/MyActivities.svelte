<script>
  import { onMount } from 'svelte';
  import { sessionFetch } from '../lib/api.js';
  import { logAction, logError } from '../lib/debugLog.js';
  import { logoutToLogin } from '../lib/logout.js';
  import { navigate } from '../lib/navigate.js';

  let email = $state('');
  let rooms = $state([]);
  let error = $state('');
  let loading = $state(true);

  onMount(async () => {
    logAction('MyActivities', 'page mount');
    try {
      const data = await sessionFetch('/me');
      email = data.email;
      rooms = data.rooms;
      logAction('MyActivities', 'loaded', { email, roomCount: rooms.length });
      if (rooms.length === 0) {
        error = 'Aucune activité accessible';
      }
    } catch (e) {
      logError('MyActivities', 'load', e);
      error = 'Session expirée — reconnectez-vous.';
    } finally {
      loading = false;
    }
  });

  async function logout() {
    await logoutToLogin();
  }

  function openRoom(room) {
    logAction('MyActivities', 'open room', { roomId: room.id, name: room.name });
    navigate(`/salon/${room.id}`);
  }

  function goLogin() {
    logoutToLogin();
  }
</script>

<main class="activities">
  <header>
    <div>
      <h1>Vos activités</h1>
      <p class="muted">{email}</p>
    </div>
    <button class="ghost" onclick={logout}>Déconnexion</button>
  </header>

  {#if loading}
    <p class="muted center">Chargement…</p>
  {:else if error}
    <div class="center">
      <p class="err">{error}</p>
      <button class="ghost" onclick={goLogin}>Se connecter</button>
    </div>
  {:else}
    <div class="buttons">
      {#each rooms as room}
        <a class="room-btn" href="/salon/{room.id}" onclick={(e) => { e.preventDefault(); openRoom(room); }}>
          <span class="room-name">{room.name}</span>
          {#if room.displayName}
            <span class="room-you">Connecté comme {room.displayName}</span>
          {/if}
        </a>
      {/each}
    </div>
  {/if}
</main>

<style>
  .activities {
    max-width: 520px;
    margin: 0 auto;
    padding: 2rem 1.25rem 4rem;
    min-height: 100vh;
  }

  header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
    margin-bottom: 2rem;
  }

  h1 {
    margin: 0;
    font-size: 1.5rem;
  }

  .muted {
    color: var(--muted);
    font-size: 0.9rem;
    margin: 0.25rem 0 0;
  }

  .center {
    text-align: center;
    margin-top: 3rem;
  }

  .err {
    color: var(--danger);
  }

  .ghost {
    background: transparent;
    border: 1px solid var(--border);
    color: var(--text);
    padding: 0.5rem 0.75rem;
    border-radius: 6px;
    font-size: 0.85rem;
  }

  .buttons {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .room-btn {
    display: block;
    padding: 1.25rem 1.5rem;
    background: var(--accent);
    color: white;
    text-decoration: none;
    border-radius: 12px;
    font-weight: 700;
    font-size: 1.15rem;
    text-align: center;
    box-shadow: 0 4px 14px rgba(107, 76, 230, 0.35);
  }

  .room-btn:hover {
    background: var(--accent-hover);
  }

  .room-name {
    display: block;
  }

  .room-you {
    display: block;
    font-size: 0.8rem;
    font-weight: 400;
    opacity: 0.85;
    margin-top: 0.35rem;
  }
</style>
