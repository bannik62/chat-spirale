<script>
  import { onMount } from 'svelte';
  import { adminFetch, adminSessionFetch, getAdminToken, setAdminToken } from '../lib/api.js';
  import { logoutToLogin } from '../lib/logout.js';
  import ParticipantPicker from '../lib/ParticipantPicker.svelte';
  import { JoinChatForm } from '../lib/fields/index.js';
  import { logAction, logError } from '../lib/debugLog.js';

  let isLoggedIn = $state(false);
  let authReady = $state(false);
  let tab = $state('salons');
  let error = $state('');
  let success = $state('');
  let loading = $state(false);

  let newChatName = $state('');
  let newChatPermanent = $state(false);
  /** @type {string[]} */
  let createRoomIds = $state([]);
  let sendInviteOnCreate = $state(true);
  let joinForm = $state(new JoinChatForm());
  let pickList = $state([]);
  let participantPicker = $state(null);

  let chats = $state([]);
  let participants = $state([]);
  let lastCreatedCode = $state('');
  /** @type {Record<string, string[]>} */
  let roomEdits = $state({});

  function syncRoomEdits() {
    const next = {};
    for (const p of participants) {
      if (!p.isRevoked) {
        next[p.id] = [...(p.chatRoomIds || [])];
      }
    }
    roomEdits = next;
  }

  function activeParticipants() {
    return participants.filter((p) => !p.isRevoked);
  }

  function toggleParticipantRoom(participantId, chatId) {
    const ids = roomEdits[participantId] || [];
    roomEdits = {
      ...roomEdits,
      [participantId]: ids.includes(chatId)
        ? ids.filter((x) => x !== chatId)
        : [...ids, chatId],
    };
    logAction('Admin', 'toggleParticipantRoom', { participantId, chatId });
  }

  function participantRoomsDirty(p) {
    const current = roomEdits[p.id] || [];
    const original = p.chatRoomIds || [];
    if (current.length !== original.length) return true;
    return current.some((id) => !original.includes(id));
  }

  async function saveParticipantRooms(p) {
    const chatRoomIds = roomEdits[p.id] || [];
    if (chatRoomIds.length === 0) {
      error = "Au moins un salon requis — utilisez « Révoquer » pour retirer l'accès.";
      return;
    }
    error = '';
    logAction('Admin', 'saveParticipantRooms', { participantId: p.id, chatRoomIds });
    loading = true;
    try {
      await adminFetch(`/participants/${p.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ chatRoomIds }),
      });
      success = `Accès mis à jour pour ${p.email}`;
      await refresh();
    } catch (e) {
      logError('Admin', 'saveParticipantRooms', e);
      error = e.message;
    } finally {
      loading = false;
    }
  }

  async function revokeParticipant(p) {
    if (!confirm(`Révoquer l'accès de ${p.email} ?\nLa personne ne pourra plus se connecter.`)) {
      logAction('Admin', 'revokeParticipant cancelled', { participantId: p.id });
      return;
    }
    logAction('Admin', 'revokeParticipant', { participantId: p.id, email: p.email });
    loading = true;
    error = '';
    try {
      await adminFetch(`/participants/${p.id}`, { method: 'DELETE' });
      success = `${p.email} révoqué(e)`;
      await refresh();
    } catch (e) {
      logError('Admin', 'revokeParticipant', e);
      error = e.message;
    } finally {
      loading = false;
    }
  }

  let canCreateParticipant = $derived.by(() => {
    const pending = participantPicker?.getPendingEmail?.() ?? null;
    const hasEmails = pickList.length > 0 || !!pending;
    return hasEmails && createRoomIds.length > 0;
  });

  let canCreateChat = $derived(newChatName.trim().length >= 2);

  function toggleCreateRoom(chatId) {
    createRoomIds = createRoomIds.includes(chatId)
      ? createRoomIds.filter((x) => x !== chatId)
      : [...createRoomIds, chatId];
    logAction('Admin', 'toggleCreateRoom', { chatId, createRoomIds });
  }

  function participantPayload(email, alreadyRegistered) {
    return {
      email: email.trim().toLowerCase(),
      chatRoomIds: [...createRoomIds],
      sendEmail: !alreadyRegistered || sendInviteOnCreate,
    };
  }

  async function refresh() {
    logAction('Admin', 'refresh lists');
    chats = await adminFetch('/chats');
    participants = await adminFetch('/participants');
    logAction('Admin', 'refresh done', { chats: chats.length, participants: participants.length });
    syncRoomEdits();
    if (createRoomIds.length === 0 && chats.length > 0) {
      createRoomIds = [chats[0].id];
    }
  }

  async function handleCreateParticipantClick() {
    logAction('Admin', 'createParticipant click', {
      pickListLen: pickList.length,
      pendingEmail: participantPicker?.getPendingEmail?.() ?? null,
      roomIds: createRoomIds,
      canSubmit: canCreateParticipant,
      loading,
    });
    await createParticipant();
  }

  async function handleCreateChatClick() {
    logAction('Admin', 'createChat click', {
      name: newChatName,
      canSubmit: canCreateChat,
      loading,
    });
    await createChat();
  }

  async function createChat() {
    error = '';
    success = '';
    const name = newChatName.trim();
    if (name.length < 2) {
      error = 'Nom trop court (2 caractères minimum)';
      logAction('Admin', 'createChat blocked', { error });
      return;
    }
    const payload = { name, isPermanent: newChatPermanent };
    logAction('Admin', 'createChat', payload);
    loading = true;
    try {
      await adminFetch('/chats', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      logAction('Admin', 'createChat success', { name: payload.name });
      success = 'Salon créé';
      newChatName = '';
      newChatPermanent = false;
      await refresh();
    } catch (e) {
      logError('Admin', 'createChat', e);
      error = e.message;
    } finally {
      loading = false;
    }
  }

  async function createParticipant() {
    error = '';
    success = '';
    lastCreatedCode = '';

    participantPicker?.flushPendingEmail?.();

    const pending = participantPicker?.getPendingEmail?.() ?? null;
    const emails = [...pickList];
    if (pending && !emails.includes(pending)) {
      emails.push(pending);
    }

    if (emails.length === 0) {
      error = 'Au moins un email requis';
      logAction('Admin', 'createParticipant blocked', { error });
      return;
    }
    if (createRoomIds.length === 0) {
      error = 'Au moins un salon requis';
      logAction('Admin', 'createParticipant blocked', { error });
      return;
    }

    logAction('Admin', 'createParticipant', {
      emails,
      roomIds: createRoomIds,
      sendInviteEmail: sendInviteOnCreate,
    });
    loading = true;
    const summaries = [];
    try {
      for (const email of emails) {
        const normalized = email.trim().toLowerCase();
        const alreadyRegistered = participants.some((p) => p.email === normalized);
        const payload = participantPayload(normalized, alreadyRegistered);

        const res = await adminFetch('/participants', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        logAction('Admin', 'createParticipant result', {
          email: res.email,
          merged: res.merged,
          mail: res.mail,
        });
        lastCreatedCode = res.accessCode;
        if (res.merged) {
          summaries.push(`${res.email} : salons ajoutés (code ${res.accessCode})`);
        } else {
          summaries.push(`${res.email} : nouveau, code ${res.accessCode}`);
        }
      }
      success = summaries.join(' · ');
      pickList = [];
      await refresh();
    } catch (e) {
      logError('Admin', 'createParticipant', e);
      error = e.message;
    } finally {
      loading = false;
    }
  }

  async function joinChat(id) {
    logAction('Admin', 'joinChat', { chatId: id });
    loading = true;
    error = '';
    try {
      const adminToken = getAdminToken();
      const res = await fetch(`/api/admin/chats/${id}/join`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify(joinForm.toJSON()),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || res.statusText);
      logAction('Admin', 'joinChat redirect', { roomUrl: data.roomUrl });
      window.location.href = data.roomUrl;
    } catch (e) {
      logError('Admin', 'joinChat', e);
      error = e.message;
      loading = false;
    }
  }

  async function deleteChat(id) {
    if (!confirm('Supprimer ce salon ?')) {
      logAction('Admin', 'deleteChat cancelled', { chatId: id });
      return;
    }
    logAction('Admin', 'deleteChat', { chatId: id });
    try {
      await adminFetch(`/chats/${id}`, { method: 'DELETE' });
      logAction('Admin', 'deleteChat success', { chatId: id });
      await refresh();
    } catch (e) {
      logError('Admin', 'deleteChat', e);
      error = e.message;
    }
  }

  async function extendChat(id) {
    logAction('Admin', 'extendChat', { chatId: id });
    try {
      await adminFetch(`/chats/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ extend: true }),
      });
      logAction('Admin', 'extendChat success', { chatId: id });
      await refresh();
    } catch (e) {
      logError('Admin', 'extendChat', e);
      error = e.message;
    }
  }

  async function resendInvite(id) {
    logAction('Admin', 'resendInvite', { participantId: id });
    try {
      const mailResult = await adminFetch(`/participants/${id}/send-invite`, { method: 'POST' });
      logAction('Admin', 'resendInvite result', mailResult);
      success = mailResult.sent
        ? 'Invitation envoyée par email'
        : mailResult.skipped
          ? 'Email non envoyé (SMTP non configuré — voir logs serveur)'
          : 'Invitation renvoyée';
    } catch (e) {
      logError('Admin', 'resendInvite', e);
      error = e.message;
    }
  }

  async function logout() {
    logAction('Admin', 'logout');
    await logoutToLogin();
  }

  onMount(async () => {
    logAction('Admin', 'page mount');
    try {
      const session = await adminSessionFetch('/session');
      if (session.role === 'admin') {
        logAction('Admin', 'session admin OK');
        isLoggedIn = true;
        await refresh();
        authReady = true;
        return;
      }
    } catch {
      /* ignore */
    }
    if (getAdminToken()) {
      try {
        await refresh();
        isLoggedIn = true;
        authReady = true;
        return;
      } catch {
        setAdminToken(null);
      }
    }
    sessionStorage.setItem('spirale_login_mode', 'admin');
    location.replace('/');
  });

  function setTab(next) {
    logAction('Admin', 'change tab', { tab: next });
    tab = next;
  }
</script>

<div class="admin">
  <header>
    <a href="/">← Connexion</a>
    <h1>Gestion — Association Spirale</h1>
    {#if isLoggedIn}<button class="ghost" onclick={logout}>Déconnexion</button>{/if}
  </header>

  {#if !authReady}
    <p class="muted center">Chargement…</p>
  {:else if isLoggedIn}
    <nav class="tabs">
      <button class:active={tab === 'salons'} onclick={() => setTab('salons')}>Salons</button>
      <button class:active={tab === 'personnes'} onclick={() => setTab('personnes')}>Personnes</button>
    </nav>

    {#if error}<p class="err banner">{error}</p>{/if}
    {#if success}<p class="ok banner">{success}</p>{/if}

    {#if tab === 'salons'}
      <section class="card">
        <h2>Nouveau salon</h2>
        <label>
          Nom de l'activité
          <input bind:value={newChatName} placeholder="Atelier janvier" />
        </label>
        <label class="row">
          <input type="checkbox" bind:checked={newChatPermanent} />
          Permanent (pas de suppression auto vendredi)
        </label>
        <button type="button" onclick={handleCreateChatClick} disabled={loading || !canCreateChat}>
          Créer le salon
        </button>
      </section>

      <section class="card">
        <h2>Salons existants</h2>
        {#if chats.length === 0}
          <p class="muted">Aucun salon.</p>
        {:else}
          <ul class="list">
            {#each chats as chat}
              <li>
                <div>
                  <strong>{chat.name}</strong>
                  <span class="muted">
                    {chat._count.memberships} personne(s) · {chat._count.messages} msg
                  </span>
                </div>
                <div class="actions">
                  <button class="join" onclick={() => joinChat(chat.id)}>Rejoindre</button>
                  {#if chat.expiresAt}
                    <button class="ghost" onclick={() => extendChat(chat.id)}>Prolonger</button>
                  {/if}
                  <button class="danger" onclick={() => deleteChat(chat.id)}>Supprimer</button>
                </div>
              </li>
            {/each}
          </ul>
        {/if}
      </section>
    {:else}
      <section class="card">
        <h2>Personnes inscrites</h2>
        <p class="muted">
          Cochez les salons autorisés pour chaque personne, puis « Enregistrer ».
          Pour ajouter quelqu'un à un salon en direct, utilisez « + Inviter » depuis le chat.
        </p>
        {#if activeParticipants().length === 0}
          <p class="muted">Aucune personne active.</p>
        {:else}
          <ul class="list person-list">
            {#each activeParticipants() as p}
              <li class="person">
                <div class="person-main">
                  <strong>{p.email}</strong>
                  <span class="code">Code : {p.accessCode}</span>
                  <fieldset class="person-rooms">
                    <legend>Salons autorisés</legend>
                    {#if chats.length === 0}
                      <p class="muted">Aucun salon créé.</p>
                    {:else}
                      {#each chats as chat}
                        <label class="row">
                          <input
                            type="checkbox"
                            checked={(roomEdits[p.id] || []).includes(chat.id)}
                            onchange={() => toggleParticipantRoom(p.id, chat.id)}
                          />
                          {chat.name}
                        </label>
                      {/each}
                    {/if}
                  </fieldset>
                </div>
                <div class="actions person-actions">
                  <button
                    class="save-access"
                    onclick={() => saveParticipantRooms(p)}
                    disabled={loading || !participantRoomsDirty(p) || (roomEdits[p.id] || []).length === 0}
                  >
                    Enregistrer
                  </button>
                  <button class="ghost" onclick={() => resendInvite(p.id)} disabled={loading}>
                    Renvoyer mail
                  </button>
                  <button class="danger" onclick={() => revokeParticipant(p)} disabled={loading}>
                    Révoquer
                  </button>
                </div>
              </li>
            {/each}
          </ul>
        {/if}
      </section>

      <details class="card add-person-details">
        <summary>Ajouter une personne (optionnel — multi-salons)</summary>
        <p class="muted">
          Alternative à « + Inviter » dans un chat. Personne déjà inscrite : <strong>même code</strong>,
          pas d'email automatique (utilisez « Renvoyer mail » ci-dessus si besoin).
        </p>
        <ParticipantPicker
          bind:this={participantPicker}
          allParticipants={participants}
          bind:pickList
        />
        <label class="row invite-mail-row">
          <input type="checkbox" bind:checked={sendInviteOnCreate} />
          Envoyer l'email avec le code (nouvelle personne uniquement par défaut)
        </label>
        <fieldset>
          <legend>Salons autorisés</legend>
          {#each chats as chat}
            <label class="row">
              <input
                type="checkbox"
                checked={createRoomIds.includes(chat.id)}
                onchange={() => toggleCreateRoom(chat.id)}
              />
              {chat.name}
            </label>
          {/each}
        </fieldset>
        <button type="button" onclick={handleCreateParticipantClick} disabled={loading || !canCreateParticipant}>
          {loading ? 'Enregistrement…' : "Enregistrer l'accès"}
        </button>
        {#if !canCreateParticipant && !loading}
          <p class="form-hint muted">
            {#if pickList.length === 0 && !participantPicker?.getPendingEmail?.()}
              Saisissez un email (puis Entrée ou ce bouton).
            {:else if createRoomIds.length === 0}
              Cochez au moins un salon.
            {/if}
          </p>
        {/if}
        {#if lastCreatedCode}
          <p class="code-display">Code : <strong>{lastCreatedCode}</strong></p>
        {/if}
      </details>
    {/if}
  {/if}
</div>

<style>
  .admin {
    max-width: 720px;
    margin: 0 auto;
    padding: 2rem 1.25rem 4rem;
  }

  header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1.5rem;
    flex-wrap: wrap;
  }

  header h1 {
    flex: 1;
    margin: 0;
    font-size: 1.5rem;
  }

  .tabs {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .tabs button {
    flex: 1;
    padding: 0.65rem;
    background: var(--surface);
    border: 1px solid var(--border);
    color: var(--muted);
    border-radius: 8px;
    font-weight: 600;
  }

  .tabs button.active {
    background: var(--accent);
    color: white;
    border-color: var(--accent);
  }

  .banner {
    margin-bottom: 1rem;
  }

  .card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 1.5rem;
    margin-bottom: 1.5rem;
  }

  .card h2 {
    margin: 0 0 1rem;
    font-size: 1.1rem;
  }

  label {
    display: block;
    margin-bottom: 1rem;
    font-size: 0.9rem;
    font-weight: 500;
  }

  fieldset {
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 1rem;
    margin-bottom: 1rem;
  }

  legend {
    padding: 0 0.25rem;
    color: var(--muted);
    font-size: 0.85rem;
  }

  input[type='email'],
  input[type='password'],
  input:not([type='checkbox']) {
    display: block;
    width: 100%;
    margin-top: 0.4rem;
    padding: 0.65rem 0.75rem;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--text);
  }

  .row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .card > button,
  button[type='submit'] {
    width: 100%;
    padding: 0.75rem;
    background: var(--accent);
    color: white;
    border: none;
    border-radius: 8px;
    font-weight: 600;
  }

  .join {
    background: var(--accent);
    color: white;
    border: none;
    padding: 0.4rem 0.75rem;
    border-radius: 6px;
    font-weight: 600;
  }

  .ghost {
    background: transparent;
    border: 1px solid var(--border);
    color: var(--text);
    padding: 0.4rem 0.75rem;
    border-radius: 6px;
  }

  .danger {
    background: transparent;
    border: 1px solid var(--danger);
    color: var(--danger);
    padding: 0.4rem 0.75rem;
    border-radius: 6px;
  }

  .list {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .list li {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
    padding: 1rem 0;
    border-bottom: 1px solid var(--border);
  }

  .list li:last-child {
    border-bottom: none;
  }

  .list strong {
    display: block;
  }

  .person .code {
    display: block;
    font-family: ui-monospace, monospace;
    font-size: 0.9rem;
    margin: 0.25rem 0 0.75rem;
    color: var(--accent-hover);
  }

  .person-list .person {
    flex-direction: column;
    align-items: stretch;
    gap: 0.75rem;
  }

  .person-main {
    flex: 1;
  }

  .person-rooms {
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 0.75rem 1rem;
    margin: 0;
  }

  .person-rooms legend {
    padding: 0 0.25rem;
    font-size: 0.8rem;
    color: var(--muted);
  }

  .person-actions {
    flex-wrap: wrap;
    width: 100%;
  }

  .save-access {
    background: var(--accent);
    color: white;
    border: none;
    padding: 0.4rem 0.75rem;
    border-radius: 6px;
    font-weight: 600;
  }

  .save-access:disabled {
    opacity: 0.5;
  }

  .add-person-details summary {
    cursor: pointer;
    font-weight: 600;
    margin-bottom: 0.75rem;
  }

  .add-person-details[open] summary {
    margin-bottom: 1rem;
  }

  .code-display {
    margin-top: 1rem;
    padding: 1rem;
    background: var(--bg);
    border-radius: 8px;
    text-align: center;
    font-size: 1.1rem;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  .err {
    color: var(--danger);
  }

  .ok {
    color: var(--success);
  }

  .muted {
    color: var(--muted);
    font-size: 0.85rem;
    display: block;
    margin-top: 0.2rem;
  }

  .form-hint {
    margin-top: 0.5rem;
    text-align: center;
  }

  .center {
    text-align: center;
    padding: 3rem;
    color: var(--muted);
  }
</style>
