<script>
  import { onMount } from 'svelte';
  import { sessionFetch } from '../lib/api.js';
  import { logAction, logError } from '../lib/debugLog.js';
  import { logoutToLogin } from '../lib/logout.js';
  import { navigate } from '../lib/navigate.js';

  let email = $state('');
  let displayName = $state('');
  let nameInput = $state('');
  let rooms = $state([]);
  let error = $state('');
  let nameError = $state('');
  let loading = $state(true);
  let savingName = $state(false);
  let showNameModal = $state(false);
  let editingName = $state(false);

  let canSaveName = $derived(nameInput.trim().length >= 2);

  async function loadData() {
    const data = await sessionFetch('/me');
    email = data.email;
    displayName = data.displayName || '';
    rooms = data.rooms;
    logAction('MyActivities', 'loaded', {
      email,
      displayName,
      roomCount: rooms.length,
    });
    if (rooms.length === 0) {
      error = 'Aucune activité accessible';
      return;
    }
    if (!displayName) {
      nameInput = '';
      showNameModal = true;
      editingName = false;
    }
  }

  onMount(async () => {
    logAction('MyActivities', 'page mount');
    try {
      await loadData();
    } catch (e) {
      logError('MyActivities', 'load', e);
      error = 'Session expirée — reconnectez-vous.';
    } finally {
      loading = false;
    }
  });

  async function saveDisplayName() {
    nameError = '';
    const name = nameInput.trim();
    if (name.length < 2) {
      nameError = '2 caractères minimum';
      return;
    }
    savingName = true;
    try {
      const res = await sessionFetch('/display-name', {
        method: 'POST',
        body: JSON.stringify({ displayName: name }),
      });
      displayName = res.displayName;
      showNameModal = false;
      editingName = false;
      logAction('MyActivities', 'displayName saved', { displayName });
    } catch (e) {
      logError('MyActivities', 'saveDisplayName', e);
      nameError = e.message;
    } finally {
      savingName = false;
    }
  }

  function openEditName() {
    nameInput = displayName;
    nameError = '';
    editingName = true;
    showNameModal = true;
  }

  function closeNameModal() {
    if (!displayName) return;
    showNameModal = false;
    editingName = false;
    nameError = '';
  }

  async function logout() {
    await logoutToLogin();
  }

  function openRoom(room) {
    if (!displayName) {
      showNameModal = true;
      return;
    }
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
      {#if displayName}
        <p class="you-line">
          Connecté comme <strong>{displayName}</strong>
          <button type="button" class="linkish" onclick={openEditName}>Modifier</button>
        </p>
      {/if}
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
        </a>
      {/each}
    </div>
  {/if}
</main>

{#if showNameModal}
  <div class="modal-backdrop">
    <div class="modal">
      <h2>{editingName ? 'Modifier votre pseudo' : 'Comment vous appelez-vous ?'}</h2>
      <p class="muted">
        {#if editingName}
          Ce pseudo sera utilisé dans tous vos salons.
        {:else}
          Choisissez un pseudo — il sera le même pour toutes vos activités.
        {/if}
      </p>
      {#if nameError}<p class="err">{nameError}</p>{/if}
      <label>
        Pseudo
        <input bind:value={nameInput} placeholder="Prénom ou pseudo" maxlength="64" />
      </label>
      <div class="modal-actions">
        {#if displayName}
          <button type="button" class="ghost" onclick={closeNameModal}>Annuler</button>
        {/if}
        <button type="button" class="primary" onclick={saveDisplayName} disabled={!canSaveName || savingName}>
          {savingName ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </div>
  </div>
{/if}

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

  .you-line {
    margin: 0.5rem 0 0;
    font-size: 0.9rem;
    color: var(--text);
  }

  .linkish {
    margin-left: 0.35rem;
    padding: 0;
    border: none;
    background: none;
    color: var(--accent-hover);
    font: inherit;
    font-size: 0.85rem;
    cursor: pointer;
    text-decoration: underline;
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
    cursor: pointer;
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

  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.75);
    display: grid;
    place-items: center;
    z-index: 100;
    padding: 1rem;
  }

  .modal {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 2rem;
    max-width: 400px;
    width: 100%;
  }

  .modal h2 {
    margin: 0 0 0.5rem;
  }

  .modal label {
    display: block;
    margin: 1rem 0;
    font-weight: 500;
  }

  .modal input {
    display: block;
    width: 100%;
    margin-top: 0.5rem;
    padding: 0.75rem;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--text);
    font-size: 1rem;
  }

  .modal-actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }

  .modal-actions .primary {
    flex: 1;
    padding: 0.75rem;
    background: var(--accent);
    color: white;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
  }

  .modal-actions .primary:disabled {
    opacity: 0.5;
  }

  .modal-actions .ghost {
    flex: 0 0 auto;
  }
</style>
