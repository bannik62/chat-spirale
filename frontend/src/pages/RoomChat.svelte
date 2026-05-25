<script>
  import { onMount } from 'svelte';
  import { io } from 'socket.io-client';
  import { roomFetch, adminFetch, fetchRoomContext } from '../lib/api.js';
  import { logoutToLogin } from '../lib/logout.js';
  import { navigate } from '../lib/navigate.js';
  import ParticipantPicker from '../lib/ParticipantPicker.svelte';
  import { InviteInRoomForm } from '../lib/fields/index.js';
  import { touchForm } from '../lib/fields/reactive.js';
  import { logAction, logError } from '../lib/debugLog.js';

  let roomId = $state('');
  let isAdmin = $state(false);
  let showInvite = $state(false);
  let pickList = $state([]);
  let invitePicker = $state(null);
  let allParticipants = $state([]);
  let inviteFeedback = $state('');
  let members = $state([]);
  let profile = $state(null);
  let showNamePrompt = $state(false);
  let showEditName = $state(false);
  let nameInput = $state('');
  let nameError = $state('');
  let savingName = $state(false);
  let messageText = $state('');
  let inviteForm = $state(new InviteInRoomForm());
  let tick = $state(0);

  let messages = $state([]);
  let systemLines = $state([]);
  /** @type {{ email: string, userName: string }[]} */
  let onlineUsers = $state([]);
  /** @type {Record<string, string>} */
  let readAtByEmail = $state({});
  /** @type {string[]} */
  let typers = $state([]);
  let error = $state('');
  let socket = $state(null);
  let listEl = $state(null);

  /** @type {ReturnType<typeof setTimeout> | null} */
  let typingTimer = null;
  /** @type {ReturnType<typeof setTimeout> | null} */
  let markReadTimer = null;

  const MAX_MESSAGE_LEN = 4000;

  function refreshUi() {
    tick++;
  }

  let canSaveName = $derived(nameInput.trim().length >= 2);

  function openEditName() {
    nameInput = profile?.displayName || '';
    nameError = '';
    showEditName = true;
  }

  function closeEditName() {
    showEditName = false;
    nameError = '';
  }

  let canSendMessage = $derived(messageText.trim().length > 0);

  let typingLabel = $derived.by(() => {
    const others = typers.filter((n) => n !== profile?.displayName);
    if (others.length === 0) return '';
    if (others.length === 1) return `${others[0]} est en train d'écrire…`;
    return `${others.join(', ')} sont en train d'écrire…`;
  });

  let onlineLabel = $derived.by(() => {
    if (onlineUsers.length <= 1) return '';
    return `${onlineUsers.length} en ligne`;
  });

  function applyRoomState(state) {
    onlineUsers = (state?.online || []).map((o) => ({
      email: o.email,
      userName: o.userName,
    }));
    const nextTypers = (state?.typers || []).filter((n) => n !== profile?.displayName);
    typers = nextTypers;
    const nextReads = { ...readAtByEmail };
    for (const r of state?.reads || []) {
      if (r.email && r.readAt) nextReads[r.email] = r.readAt;
    }
    readAtByEmail = nextReads;
  }

  /** @param {{ email?: string, readAt?: string }} data */
  function applyReadUpdate(data) {
    if (data?.email && data?.readAt) {
      readAtByEmail = { ...readAtByEmail, [data.email]: data.readAt };
    }
  }

  function isNearBottom() {
    if (!listEl) return true;
    return listEl.scrollHeight - listEl.scrollTop - listEl.clientHeight < 48;
  }

  function scheduleMarkRead() {
    clearTimeout(markReadTimer);
    markReadTimer = setTimeout(() => {
      if (!socket?.connected || messages.length === 0 || !isNearBottom()) return;
      const last = messages[messages.length - 1];
      socket.emit('mark-read', { messageId: last.id, readAt: new Date().toISOString() });
    }, 400);
  }

  function onMessageInput() {
    if (messageText.length > MAX_MESSAGE_LEN) {
      messageText = messageText.slice(0, MAX_MESSAGE_LEN);
    }
    if (!socket?.connected) return;
    socket.emit('typing', { typing: true });
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => socket?.emit('typing', { typing: false }), 2000);
  }

  /** @param {{ senderEmail: string, createdAt: string }} msg */
  function readLabel(msg) {
    if (!profile || msg.senderEmail !== profile.email) return '';
    const others = onlineUsers.filter((u) => u.email !== profile.email);
    if (others.length === 0) return '';
    const msgTs = new Date(msg.createdAt).getTime();
    const seen = others.filter((u) => {
      const readAt = readAtByEmail[u.email];
      return readAt && new Date(readAt).getTime() >= msgTs;
    });
    if (seen.length === 0) return '';
    if (seen.length === others.length) return 'Vu';
    return `Vu par ${seen.map((u) => u.userName).join(', ')}`;
  }

  function onMessagesScroll() {
    if (isNearBottom()) scheduleMarkRead();
  }

  let canAddParticipants = $derived.by(() => {
    tick;
    pickList;
    const pending = invitePicker?.getPendingEmail?.() ?? null;
    return pickList.length > 0 || !!pending;
  });

  function getRoomId() {
    const m = window.location.pathname.match(/^\/salon\/([^/]+)/);
    return m?.[1] || '';
  }

  async function loadProfile(id) {
    logAction('RoomChat', 'loadProfile', { roomId: id });
    profile = await roomFetch(id, '/profile');
    if (!profile.displayName) {
      nameInput = '';
      showNamePrompt = true;
      showEditName = false;
      return false;
    }
    return true;
  }

  async function saveName() {
    nameError = '';
    const name = nameInput.trim();
    if (name.length < 2) {
      nameError = '2 caractères minimum';
      logAction('RoomChat', 'saveName blocked', { error: nameError });
      return;
    }
    savingName = true;
    logAction('RoomChat', 'saveName', { displayName: name });
    try {
      const res = await roomFetch(roomId, '/set-name', {
        method: 'POST',
        body: JSON.stringify({ displayName: name }),
      });
      logAction('RoomChat', 'saveName success');
      profile = { ...profile, displayName: res.displayName };
      showNamePrompt = false;
      showEditName = false;
      const wasConnected = socket?.connected;
      if (wasConnected) {
        socket?.disconnect();
      }
      await connectSocket();
    } catch (e) {
      logError('RoomChat', 'saveName', e);
      nameError = e.message;
    } finally {
      savingName = false;
    }
  }

  async function loadMembers() {
    if (!isAdmin || !roomId) return;
    logAction('RoomChat', 'loadMembers', { roomId });
    try {
      members = await adminFetch(`/chats/${roomId}/members`);
    } catch (e) {
      logError('RoomChat', 'loadMembers', e);
      members = [];
    }
  }

  async function loadAllParticipants() {
    logAction('RoomChat', 'loadAllParticipants');
    try {
      allParticipants = await adminFetch('/participants');
    } catch (e) {
      logError('RoomChat', 'loadAllParticipants', e);
      allParticipants = [];
    }
  }

  async function openInvite() {
    showInvite = !showInvite;
    logAction('RoomChat', 'toggle invite panel', { open: showInvite });
    if (showInvite) {
      pickList = [];
      inviteFeedback = '';
      inviteForm.emails.clear();
      inviteForm = touchForm(inviteForm);
      await Promise.all([loadMembers(), loadAllParticipants()]);
    }
  }

  async function addParticipants() {
    inviteFeedback = '';
    logAction('RoomChat', 'addParticipants click', {
      pickListLen: pickList.length,
      pendingEmail: invitePicker?.getPendingEmail?.() ?? null,
    });

    invitePicker?.flushPendingEmail?.();

    inviteForm.emails.clear();
    for (const email of pickList) {
      inviteForm.emails.add(email);
    }

    const err = inviteForm.firstError();
    if (err) {
      inviteFeedback = err;
      logAction('RoomChat', 'addParticipants blocked', { error: err });
      return;
    }

    const payload = inviteForm.toJSON();
    logAction('RoomChat', 'addParticipants', payload);

    try {
      const res = await adminFetch(`/chats/${roomId}/add-participants`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      logAction('RoomChat', 'addParticipants results', res.results);
      const lines = res.results.map((r) => {
        if (r.isNew) return `${r.email} : nouveau, code ${r.accessCode}${r.mail?.sent ? ', email envoyé' : ''}`;
        if (r.alreadyInRoom) return `${r.email} : déjà dans le salon (code ${r.accessCode})`;
        return `${r.email} : accès ajouté, même code ${r.accessCode}`;
      });
      inviteFeedback = lines.join('\n');
      pickList = [];
      inviteForm.emails.clear();
      inviteForm = touchForm(inviteForm);
      await Promise.all([loadMembers(), loadAllParticipants()]);
    } catch (e) {
      logError('RoomChat', 'addParticipants', e);
      inviteFeedback = e.message;
    }
  }

  async function connectSocket() {
    logAction('RoomChat', 'connectSocket', { roomId });
    messages = await roomFetch(roomId, '/messages');

    socket?.disconnect();
    socket = io({
      path: '/socket.io',
      withCredentials: true,
      auth: { roomId },
    });

    socket.on('message', (msg) => {
      logAction('RoomChat', 'socket message received', { id: msg.id, sender: msg.senderName });
      messages = [...messages, msg];
      scrollBottom();
      scheduleMarkRead();
    });

    socket.on('room-state', (state) => {
      applyRoomState(state);
    });

    socket.on('read-update', (data) => {
      applyReadUpdate(data);
    });

    socket.on('system-message', (ev) => {
      logAction('RoomChat', 'socket system-message', ev);
      systemLines = [...systemLines, ev];
    });

    socket.on('connect_error', () => {
      logError('RoomChat', 'socket connect_error', 'Connexion temps réel impossible');
      error = 'Connexion temps réel impossible — rechargez la page';
    });

    socket.on('connect', () => {
      logAction('RoomChat', 'socket connected');
      scheduleMarkRead();
    });
  }

  function sendMessage() {
    const content = messageText.trim();
    if (!content || !socket?.connected) {
      logAction('RoomChat', 'sendMessage blocked', {
        empty: !content,
        connected: socket?.connected,
      });
      return;
    }
    logAction('RoomChat', 'sendMessage', { length: content.length });
    clearTimeout(typingTimer);
    socket.emit('typing', { typing: false });
    socket.emit('message', { content });
    messageText = '';
  }

  function scrollBottom() {
    requestAnimationFrame(() => {
      if (listEl) listEl.scrollTop = listEl.scrollHeight;
    });
  }

  async function logout() {
    socket?.disconnect();
    await logoutToLogin();
  }

  function goActivities() {
    logAction('RoomChat', 'go activities');
    navigate('/mes-activites');
  }

  onMount(() => {
    roomId = getRoomId();
    if (!roomId) {
      error = 'Salon introuvable';
      return;
    }

    fetchRoomContext()
      .then((ctx) => {
        isAdmin = ctx.isFormateur;
        if (ctx._legacyBackend) {
          logAction('RoomChat', 'legacy backend — isFormateur=false, rebuild backend');
        }
        logAction('RoomChat', 'page mount', { roomId, isAdmin });
        return loadProfile(roomId);
      })
      .then((ok) => {
        if (ok) {
          if (isAdmin) loadMembers();
          return connectSocket();
        }
      })
      .catch((e) => {
        logError('RoomChat', 'init', e);
        if (e.message.includes('connecté') || e.message.includes('Session')) {
          location.href = '/';
        } else {
          error = e.message;
        }
      });

    return () => {
      clearTimeout(typingTimer);
      clearTimeout(markReadTimer);
      socket?.disconnect();
    };
  });

  $effect(() => {
    if (messages.length) scrollBottom();
    if (messages.length && profile) scheduleMarkRead();
  });
</script>

<div class="chat-page">
  {#if error && !profile}
    <div class="center">
      <p class="err">{error}</p>
      <a href="/mes-activites">← Mes activités</a>
    </div>
  {:else if showNamePrompt && profile}
    <div class="modal-backdrop">
      <div class="modal">
        <h2>Bienvenue</h2>
        <p>Activité : <strong>{profile.chatRoom.name}</strong></p>
        <p class="muted">{profile.email}</p>
        <p class="muted">Ce pseudo sera le même pour tous vos salons.</p>
        {#if nameError}<p class="err">{nameError}</p>{/if}
        <label>
          Comment vous appelez-vous ?
          <input bind:value={nameInput} placeholder="Prénom ou pseudo" maxlength="64" />
        </label>
        <button type="button" onclick={saveName} disabled={!canSaveName || savingName}>
          {savingName ? 'Enregistrement…' : 'Entrer dans le groupe'}
        </button>
      </div>
    </div>
  {:else if profile}
    <header>
      <div>
        <p class="room">{profile.chatRoom.name}</p>
        <p class="you">
          {profile.displayName}
          <button type="button" class="linkish" onclick={openEditName}>Modifier</button>
          · {profile.email}
          {#if onlineLabel}
            <span class="online-dot"> · {onlineLabel}</span>
          {/if}
        </p>
      </div>
      <div class="header-actions">
        {#if isAdmin}
          <button type="button" class="invite-toggle" onclick={openInvite}>
            {showInvite ? 'Fermer' : '+ Inviter'}
          </button>
          <a class="back" href="/admin">← Admin</a>
        {:else}
          <a class="back" href="/mes-activites" onclick={(e) => { e.preventDefault(); goActivities(); }}>Activités</a>
        {/if}
        <button type="button" class="back logout-btn" onclick={logout}>Déconnexion</button>
      </div>
    </header>

    {#if isAdmin && showInvite}
      <section class="invite-panel">
        <h3>Ajouter des personnes à ce salon</h3>
        <p class="muted">
          Choisissez dans la liste ou tapez un nouvel email. Même code si déjà inscrit.
        </p>
        <ParticipantPicker
          bind:this={invitePicker}
          {allParticipants}
          bind:pickList
          roomMemberEmails={members.map((m) => m.email)}
          onSelectionChange={refreshUi}
        />
        <button
          type="button"
          class="invite-submit"
          onclick={addParticipants}
          disabled={!canAddParticipants}
        >
          Mettre à jour les accès ({pickList.length}{invitePicker?.getPendingEmail?.() ? '+1' : ''})
        </button>
        {#if inviteFeedback}
          <pre class="invite-result">{inviteFeedback}</pre>
        {/if}
        {#if members.length > 0}
          <details class="members-list">
            <summary>{members.length} personne(s) autorisée(s)</summary>
            <ul>
              {#each members as m}
                <li>
                  {m.displayName || '—'} · {m.email}
                  <span class="code-hint">({m.accessCode})</span>
                </li>
              {/each}
            </ul>
          </details>
        {/if}
      </section>
    {/if}

    <div class="messages" bind:this={listEl} onscroll={onMessagesScroll}>
      {#each messages as msg}
        <div class="msg" class:mine={msg.senderEmail === profile.email}>
          <span class="author">{msg.senderName}</span>
          <span class="body">{msg.content}</span>
          <div class="msg-meta">
            <time>{new Date(msg.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</time>
            {#if readLabel(msg)}
              <span class="read-status">{readLabel(msg)}</span>
            {/if}
          </div>
        </div>
      {/each}
      {#each systemLines as line}
        <p class="system">{line.content}</p>
      {/each}
    </div>

    {#if typingLabel}
      <p class="typing-indicator">{typingLabel}</p>
    {/if}

    <form
      class="composer"
      onsubmit={(e) => {
        e.preventDefault();
        sendMessage();
      }}
    >
      <input
        bind:value={messageText}
        placeholder="Votre message…"
        autocomplete="off"
        oninput={onMessageInput}
      />
      <button type="submit" disabled={!canSendMessage}>Envoyer</button>
    </form>

    {#if showEditName}
      <div class="modal-backdrop">
        <div class="modal">
          <h2>Modifier votre pseudo</h2>
          <p class="muted">Utilisé dans tous vos salons.</p>
          {#if nameError}<p class="err">{nameError}</p>{/if}
          <label>
            Pseudo
            <input bind:value={nameInput} placeholder="Prénom ou pseudo" maxlength="64" />
          </label>
          <div class="modal-actions">
            <button type="button" class="ghost-btn" onclick={closeEditName}>Annuler</button>
            <button type="button" class="primary-btn" onclick={saveName} disabled={!canSaveName || savingName}>
              {savingName ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </div>
      </div>
    {/if}
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
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
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

  .linkish {
    margin: 0 0.15rem;
    padding: 0;
    border: none;
    background: none;
    color: var(--accent-hover);
    font: inherit;
    font-size: 0.8rem;
    cursor: pointer;
    text-decoration: underline;
  }

  .modal-actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }

  .ghost-btn {
    padding: 0.75rem 1rem;
    background: transparent;
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--text);
    cursor: pointer;
  }

  .primary-btn {
    flex: 1;
    padding: 0.75rem;
    background: var(--accent);
    color: white;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
  }

  .primary-btn:disabled {
    opacity: 0.5;
  }

  .online-dot {
    color: var(--success);
  }

  .typing-indicator {
    margin: 0;
    padding: 0.35rem 1.25rem;
    font-size: 0.8rem;
    font-style: italic;
    color: var(--muted);
    background: var(--surface);
    border-top: 1px solid var(--border);
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  .back {
    font-size: 0.85rem;
    color: var(--muted);
    text-decoration: none;
    white-space: nowrap;
  }

  .logout-btn {
    background: transparent;
    border: none;
    padding: 0;
    cursor: pointer;
    font: inherit;
  }

  .logout-btn:hover {
    color: var(--text);
  }

  .invite-toggle {
    padding: 0.4rem 0.65rem;
    background: var(--accent);
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 0.8rem;
    font-weight: 600;
  }

  .invite-panel {
    padding: 1rem 1.25rem;
    background: var(--surface);
    border-bottom: 1px solid var(--border);
  }

  .invite-panel h3 {
    margin: 0 0 0.35rem;
    font-size: 1rem;
  }

  .invite-submit {
    margin-top: 0.75rem;
    width: 100%;
    padding: 0.65rem;
    background: var(--accent);
    color: white;
    border: none;
    border-radius: 8px;
    font-weight: 600;
  }

  .invite-submit:disabled {
    opacity: 0.5;
  }

  .invite-result {
    margin: 0.75rem 0 0;
    padding: 0.75rem;
    background: var(--bg);
    border-radius: 8px;
    font-size: 0.8rem;
    white-space: pre-wrap;
    color: var(--success);
  }

  .members-list {
    margin-top: 1rem;
    font-size: 0.85rem;
  }

  .members-list ul {
    margin: 0.5rem 0 0;
    padding-left: 1.25rem;
    color: var(--muted);
  }

  .code-hint {
    font-family: ui-monospace, monospace;
    font-size: 0.75rem;
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

  .msg.mine {
    margin-left: auto;
    border-color: rgba(107, 76, 230, 0.35);
  }

  .msg-meta {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.35rem;
  }

  .read-status {
    font-size: 0.72rem;
    color: var(--success);
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
  }

  .system {
    text-align: center;
    font-size: 0.8rem;
    color: var(--muted);
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

  .composer button:disabled {
    opacity: 0.5;
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
    width: 100%;
    padding: 0.75rem;
    margin-top: 0.5rem;
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

  .modal button:disabled {
    opacity: 0.5;
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
