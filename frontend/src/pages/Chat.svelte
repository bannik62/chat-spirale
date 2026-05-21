<script>
  import { onMount } from 'svelte';
  import { io } from 'socket.io-client';
  import { chatFetch } from '../lib/api.js';

  let token = $state('');
  let profile = $state(null);
  let showNamePrompt = $state(false);
  let displayName = $state('');
  let messages = $state([]);
  let systemLines = $state([]);
  let draft = $state('');
  let error = $state('');
  let socket = $state(null);
  let listEl = $state(null);

  async function initSession(t) {
    await fetch(`/api/chat/session?token=${encodeURIComponent(t)}`, { credentials: 'include' });
    profile = await chatFetch('/profile', { token: t });
    if (!profile.displayName) {
      showNamePrompt = true;
      return;
    }
    await joinChat(t);
  }

  async function saveName() {
    error = '';
    try {
      await chatFetch('/set-name', {
        method: 'POST',
        token,
        body: JSON.stringify({ displayName }),
      });
      profile.displayName = displayName.trim();
      showNamePrompt = false;
      await joinChat(token);
    } catch (e) {
      error = e.message;
    }
  }

  async function joinChat(t) {
    messages = await chatFetch('/messages', { token: t });

    socket?.disconnect();
    socket = io({ auth: { token: t }, path: '/socket.io' });

    socket.on('message', (msg) => {
      messages = [...messages, msg];
      scrollBottom();
    });

    socket.on('system-message', (ev) => {
      systemLines = [...systemLines, ev];
    });

    socket.on('connect_error', () => {
      error = 'Connexion temps réel impossible';
    });
  }

  function sendMessage() {
    const text = draft.trim();
    if (!text || !socket?.connected) return;
    socket.emit('message', { content: text });
    draft = '';
  }

  function scrollBottom() {
    requestAnimationFrame(() => {
      if (listEl) listEl.scrollTop = listEl.scrollHeight;
    });
  }

  onMount(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('token');
    if (!t) {
      error = 'Lien invalide — token manquant';
      return;
    }
    token = t;
    initSession(t).catch((e) => {
      error = e.message;
    });

    return () => socket?.disconnect();
  });

  $effect(() => {
    if (messages.length) scrollBottom();
  });
</script>

<div class="chat-page">
  {#if error && !profile}
    <div class="center">
      <p class="err">{error}</p>
      <a href="/">Retour à l'accueil</a>
    </div>
  {:else if showNamePrompt && profile}
    <div class="modal-backdrop">
      <div class="modal">
        <h2>Bienvenue</h2>
        <p>Connecté en tant que <strong>{profile.email}</strong></p>
        <p class="muted">Choisissez votre nom pour le chat :</p>
        {#if error}<p class="err">{error}</p>{/if}
        <input bind:value={displayName} placeholder="Prénom ou pseudo" autofocus />
        <button onclick={saveName} disabled={displayName.trim().length < 2}>
          Rejoindre le chat
        </button>
      </div>
    </div>
  {:else if profile}
    <header>
      <div>
        <p class="room">{profile.chatRoom.name}</p>
        <p class="you">{profile.displayName} · {profile.email}</p>
      </div>
    </header>

    <div class="messages" bind:this={listEl}>
      {#each messages as msg}
        <div class="msg">
          <span class="author">{msg.senderName}</span>
          <span class="body">{msg.content}</span>
          <time>{new Date(msg.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</time>
        </div>
      {/each}
      {#each systemLines as line}
        <p class="system">{line.content}</p>
      {/each}
    </div>

    <form
      class="composer"
      onsubmit={(e) => {
        e.preventDefault();
        sendMessage();
      }}
    >
      <input bind:value={draft} placeholder="Votre message…" autocomplete="off" />
      <button type="submit" disabled={!draft.trim()}>Envoyer</button>
    </form>
  {:else}
    <div class="center"><p class="muted">Chargement…</p></div>
  {/if}
</div>

<style>
  .chat-page {
    display: flex;
    flex-direction: column;
    height: 100vh;
    max-width: 800px;
    margin: 0 auto;
  }

  header {
    padding: 1rem 1.25rem;
    border-bottom: 1px solid var(--border);
    background: var(--surface);
  }

  .room {
    margin: 0;
    font-weight: 700;
    font-size: 1.1rem;
  }

  .you {
    margin: 0.25rem 0 0;
    font-size: 0.85rem;
    color: var(--muted);
  }

  .messages {
    flex: 1;
    overflow-y: auto;
    padding: 1rem 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .msg {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 0.65rem 0.85rem;
    max-width: 85%;
  }

  .author {
    display: block;
    font-weight: 600;
    font-size: 0.85rem;
    color: var(--accent-hover);
    margin-bottom: 0.2rem;
  }

  .body {
    display: block;
    line-height: 1.45;
  }

  time {
    display: block;
    font-size: 0.75rem;
    color: var(--muted);
    margin-top: 0.35rem;
  }

  .system {
    text-align: center;
    font-size: 0.8rem;
    color: var(--muted);
    margin: 0.25rem 0;
  }

  .composer {
    display: flex;
    gap: 0.5rem;
    padding: 1rem 1.25rem;
    border-top: 1px solid var(--border);
    background: var(--surface);
  }

  .composer input {
    flex: 1;
    padding: 0.75rem 1rem;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--text);
  }

  .composer button {
    padding: 0.75rem 1.25rem;
    background: var(--accent);
    color: white;
    border: none;
    border-radius: 8px;
    font-weight: 600;
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

  .modal input {
    width: 100%;
    padding: 0.75rem;
    margin: 1rem 0;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--text);
  }

  .modal button {
    width: 100%;
    padding: 0.75rem;
    background: var(--accent);
    color: white;
    border: none;
    border-radius: 8px;
    font-weight: 600;
  }

  .center {
    flex: 1;
    display: grid;
    place-items: center;
    text-align: center;
    padding: 2rem;
  }

  .err {
    color: var(--danger);
  }

  .muted {
    color: var(--muted);
  }
</style>
