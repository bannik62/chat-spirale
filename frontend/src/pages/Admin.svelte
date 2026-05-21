<script>
  import { adminFetch, getAdminToken, setAdminToken } from '../lib/api.js';

  let token = $state(getAdminToken());
  let email = $state('');
  let password = $state('');
  let error = $state('');
  let loading = $state(false);

  let chatName = $state('');
  let emailList = $state('');
  let isPermanent = $state(false);
  let chats = $state([]);
  let success = $state('');

  async function login() {
    error = '';
    loading = true;
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAdminToken(data.token);
      token = data.token;
      await loadChats();
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  async function loadChats() {
    chats = await adminFetch('/chats');
  }

  async function createChat() {
    error = '';
    success = '';
    const emails = emailList
      .split('\n')
      .map((e) => e.trim())
      .filter((e) => e.includes('@'));

    if (!chatName.trim() || emails.length === 0) {
      error = 'Nom et au moins un email requis';
      return;
    }

    loading = true;
    try {
      const res = await adminFetch('/chats', {
        method: 'POST',
        body: JSON.stringify({ name: chatName, emails, isPermanent }),
      });
      success = `Chat créé — ${res.invitationsSent}/${res.invitationsTotal} email(s) envoyé(s)`;
      chatName = '';
      emailList = '';
      isPermanent = false;
      await loadChats();
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  async function deleteChat(id) {
    if (!confirm('Supprimer ce chat et tous ses messages ?')) return;
    await adminFetch(`/chats/${id}`, { method: 'DELETE' });
    await loadChats();
  }

  async function extendChat(id) {
    await adminFetch(`/chats/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ extend: true }),
    });
    await loadChats();
  }

  function logout() {
    setAdminToken(null);
    token = null;
    chats = [];
  }

  $effect(() => {
    if (token) loadChats().catch(() => logout());
  });
</script>

<div class="admin">
  <header>
    <a href="/">← Accueil</a>
    <h1>Administration</h1>
    {#if token}
      <button class="ghost" onclick={logout}>Déconnexion</button>
    {/if}
  </header>

  {#if !token}
    <form class="card" onsubmit={(e) => { e.preventDefault(); login(); }}>
      <h2>Connexion</h2>
      {#if error}<p class="err">{error}</p>{/if}
      <label>
        Email
        <input type="email" bind:value={email} required />
      </label>
      <label>
        Mot de passe
        <input type="password" bind:value={password} required />
      </label>
      <button type="submit" disabled={loading}>Se connecter</button>
    </form>
  {:else}
    <section class="card">
      <h2>Nouveau chat</h2>
      {#if error}<p class="err">{error}</p>{/if}
      {#if success}<p class="ok">{success}</p>{/if}
      <label>
        Nom du chat
        <input bind:value={chatName} placeholder="Formation — Groupe A" />
      </label>
      <label>
        Emails <small>(un par ligne)</small>
        <textarea
          bind:value={emailList}
          rows="6"
          placeholder="jean@example.com&#10;marie@example.com"
        ></textarea>
      </label>
      <label class="row">
        <input type="checkbox" bind:checked={isPermanent} />
        Chat permanent (pas de suppression auto le vendredi)
      </label>
      <button onclick={createChat} disabled={loading}>Créer et envoyer les invitations</button>
    </section>

    <section class="card">
      <h2>Chats existants</h2>
      {#if chats.length === 0}
        <p class="muted">Aucun chat pour le moment.</p>
      {:else}
        <ul class="chat-list">
          {#each chats as chat}
            <li>
              <div>
                <strong>{chat.name}</strong>
                <span class="muted">
                  {chat._count.tokens} participant(s) · {chat._count.messages} message(s)
                </span>
                {#if chat.expiresAt}
                  <span class="exp">Expire {new Date(chat.expiresAt).toLocaleString('fr-FR')}</span>
                {:else}
                  <span class="perm">Permanent</span>
                {/if}
              </div>
              <div class="actions">
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
    margin-bottom: 2rem;
    flex-wrap: wrap;
  }

  header h1 {
    flex: 1;
    margin: 0;
    font-size: 1.5rem;
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

  label small {
    font-weight: 400;
    color: var(--muted);
  }

  input[type='text'],
  input[type='email'],
  input[type='password'],
  textarea {
    display: block;
    width: 100%;
    margin-top: 0.4rem;
    padding: 0.65rem 0.75rem;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--text);
  }

  textarea {
    font-family: ui-monospace, monospace;
    resize: vertical;
  }

  .row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  button[type='submit'],
  .card > button {
    width: 100%;
    padding: 0.75rem;
    background: var(--accent);
    color: white;
    border: none;
    border-radius: 8px;
    font-weight: 600;
  }

  button:disabled {
    opacity: 0.5;
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

  .err {
    color: var(--danger);
    margin: 0 0 1rem;
  }

  .ok {
    color: var(--success);
    margin: 0 0 1rem;
  }

  .muted {
    color: var(--muted);
    font-size: 0.85rem;
  }

  .chat-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .chat-list li {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
    padding: 1rem 0;
    border-bottom: 1px solid var(--border);
  }

  .chat-list li:last-child {
    border-bottom: none;
  }

  .chat-list strong {
    display: block;
  }

  .exp,
  .perm {
    display: block;
    font-size: 0.8rem;
    margin-top: 0.25rem;
  }

  .perm {
    color: var(--success);
  }

  .exp {
    color: var(--muted);
  }

  .actions {
    display: flex;
    gap: 0.5rem;
    flex-shrink: 0;
  }
</style>
