<script>
  import { onMount } from 'svelte';
  import { adminFetch, authFetch, getAdminToken, setAdminToken } from '../lib/api.js';
  import ParticipantPicker from '../lib/ParticipantPicker.svelte';
  import { CreateChatForm, CreateParticipantForm, JoinChatForm } from '../lib/fields/index.js';
  import { touchForm } from '../lib/fields/reactive.js';

  let isLoggedIn = $state(false);
  let authReady = $state(false);
  let tab = $state('salons');
  let error = $state('');
  let success = $state('');
  let loading = $state(false);

  let chatForm = $state(new CreateChatForm());
  let participantForm = $state(new CreateParticipantForm());
  let joinForm = $state(new JoinChatForm());
  let pickList = $state([]);
  let tick = $state(0);

  let chats = $state([]);
  let participants = $state([]);
  let lastCreatedCode = $state('');

  function refreshUi() {
    tick++;
  }

  let canCreateParticipant = $derived.by(() => {
    tick;
    pickList;
    participantForm.roomIds.ids;
    return pickList.length > 0 && participantForm.roomIds.isValid;
  });

  async function refresh() {
    chats = await adminFetch('/chats');
    participants = await adminFetch('/participants');
    participantForm.roomIds.setDefault(chats.map((c) => c.id));
    participantForm = touchForm(participantForm);
    refreshUi();
  }

  async function createChat() {
    error = '';
    success = '';
    const err = chatForm.firstError();
    if (err) {
      error = err;
      return;
    }
    loading = true;
    try {
      await adminFetch('/chats', {
        method: 'POST',
        body: JSON.stringify(chatForm.toJSON()),
      });
      success = 'Salon créé';
      chatForm.reset();
      chatForm = touchForm(chatForm);
      await refresh();
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  async function createParticipant() {
    error = '';
    success = '';
    lastCreatedCode = '';

    participantForm.emails.clear();
    for (const email of pickList) {
      participantForm.emails.add(email);
    }

    const err = participantForm.firstError();
    if (err) {
      error = err;
      return;
    }

    loading = true;
    const summaries = [];
    try {
      for (const email of pickList) {
        const normalized = email;
        const alreadyRegistered = participants.some((p) => p.email === normalized);
        const payload = participantForm.payloadForEmail(email, { alreadyRegistered });

        const res = await adminFetch('/participants', {
          method: 'POST',
          body: JSON.stringify(payload),
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
      participantForm.emails.clear();
      participantForm = touchForm(participantForm);
      await refresh();
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  function toggleRoom(id) {
    participantForm.roomIds.toggle(id);
    participantForm = touchForm(participantForm);
    refreshUi();
  }

  async function joinChat(id) {
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
      window.location.href = data.roomUrl;
    } catch (e) {
      error = e.message;
      loading = false;
    }
  }

  async function deleteChat(id) {
    if (!confirm('Supprimer ce salon ?')) return;
    await adminFetch(`/chats/${id}`, { method: 'DELETE' });
    await refresh();
  }

  async function extendChat(id) {
    await adminFetch(`/chats/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ extend: true }),
    });
    await refresh();
  }

  async function resendInvite(id) {
    await adminFetch(`/participants/${id}/send-invite`, { method: 'POST' });
    success = 'Invitation renvoyée (ou voir logs)';
  }

  async function logout() {
    setAdminToken(null);
    try {
      await authFetch('/logout', { method: 'POST' });
    } catch {
      /* ignore */
    }
    location.href = '/';
  }

  onMount(async () => {
    try {
      const session = await authFetch('/session');
      if (session.role === 'admin') {
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
    location.replace('/?mode=admin');
  });
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
      <button class:active={tab === 'salons'} onclick={() => (tab = 'salons')}>Salons</button>
      <button class:active={tab === 'personnes'} onclick={() => (tab = 'personnes')}>Personnes</button>
    </nav>

    {#if error}<p class="err banner">{error}</p>{/if}
    {#if success}<p class="ok banner">{success}</p>{/if}

    {#if tab === 'salons'}
      <section class="card">
        <h2>Nouveau salon</h2>
        <label>
          Nom de l'activité
          <input bind:value={chatForm.name.value} placeholder="Atelier janvier" />
        </label>
        <label class="row">
          <input type="checkbox" bind:checked={chatForm.isPermanent.checked} />
          Permanent (pas de suppression auto vendredi)
        </label>
        <button onclick={createChat} disabled={loading || !chatForm.canSubmit}>Créer le salon</button>
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
        <h2>Ajouter une personne</h2>
        <p class="muted">
          Cochez les salons à ajouter. Personne déjà inscrite : <strong>même code</strong>,
          pas d'email automatique (utilisez « Renvoyer mail » dans la liste si besoin).
        </p>
        <ParticipantPicker allParticipants={participants} bind:pickList />
        <label class="row invite-mail-row">
          <input type="checkbox" bind:checked={participantForm.sendInviteEmail.checked} />
          Envoyer l'email avec le code (nouvelle personne uniquement par défaut)
        </label>
        <fieldset>
          <legend>Salons autorisés</legend>
          {#each chats as chat}
            <label class="row">
              <input
                type="checkbox"
                checked={participantForm.roomIds.includes(chat.id)}
                onchange={() => toggleRoom(chat.id)}
              />
              {chat.name}
            </label>
          {/each}
        </fieldset>
        <button onclick={createParticipant} disabled={loading || !canCreateParticipant}>
          {loading ? 'Enregistrement…' : "Enregistrer l'accès"}
        </button>
        {#if lastCreatedCode}
          <p class="code-display">Code : <strong>{lastCreatedCode}</strong></p>
        {/if}
      </section>

      <section class="card">
        <h2>Personnes inscrites</h2>
        {#if participants.length === 0}
          <p class="muted">Aucune personne.</p>
        {:else}
          <ul class="list">
            {#each participants as p}
              <li class="person">
                <div>
                  <strong>{p.email}</strong>
                  <span class="code">Code : {p.accessCode}</span>
                  <span class="muted">
                    {#each p.rooms as r, i}
                      {r.name}{i < p.rooms.length - 1 ? ' · ' : ''}
                    {/each}
                  </span>
                </div>
                <div class="actions">
                  <button class="ghost" onclick={() => resendInvite(p.id)}>Renvoyer mail</button>
                </div>
              </li>
            {/each}
          </ul>
        {/if}
      </section>
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
    margin: 0.25rem 0;
    color: var(--accent-hover);
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

  .center {
    text-align: center;
    padding: 3rem;
    color: var(--muted);
  }
</style>
