<script>
  import { onMount } from 'svelte';
  import { authFetch, setAdminToken } from '../lib/api.js';
  import { PortalLoginForm } from '../lib/fields/index.js';
  import { touchForm } from '../lib/fields/reactive.js';

  let form = $state(new PortalLoginForm());
  let tick = $state(0);
  let error = $state('');
  let loading = $state(false);
  let checking = $state(true);

  function refresh() {
    tick++;
  }

  let canSubmit = $derived.by(() => {
    tick;
    return form.canSubmit;
  });

  onMount(async () => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'admin') {
      form.mode.value = 'admin';
      form = touchForm(form);
    }

    try {
      const session = await authFetch('/session');
      if (session.role === 'admin') {
        location.replace('/admin');
        return;
      }
      if (session.role === 'participant' && session.redirect) {
        location.replace(session.redirect);
        return;
      }
    } catch {
      /* pas connecté */
    }
    checking = false;
  });

  function setMode(mode) {
    form.mode.value = mode;
    form = touchForm(form);
    refresh();
  }

  async function submit() {
    error = '';
    const err = form.firstError();
    if (err) {
      error = err;
      return;
    }
    loading = true;
    try {
      const res = await fetch('/api/auth/portal-login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form.toJSON()),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (data.role === 'admin') {
        if (data.token) setAdminToken(data.token);
        location.href = data.redirect || '/admin';
        return;
      }

      location.href = data.redirect || '/mes-activites';
    } catch (e) {
      error = e.message;
      loading = false;
    }
  }
</script>

<main class="login">
  <div class="card">
    <p class="badge">Association Spirale</p>
    <h1>Connexion</h1>

    {#if checking}
      <p class="muted">Vérification…</p>
    {:else}
      <div class="tabs">
        <button
          type="button"
          class:active={form.mode.isParticipant}
          onclick={() => setMode('participant')}
        >
          Participant
        </button>
        <button
          type="button"
          class:active={form.mode.isAdmin}
          onclick={() => setMode('admin')}
        >
          Formateur
        </button>
      </div>

      <p class="lead">
        {#if form.mode.isParticipant}
          Votre email et le code reçu par l'association.
        {:else}
          Votre email et votre mot de passe formateur.
        {/if}
      </p>

      {#if error}<p class="err">{error}</p>{/if}

      <label>
        Email
        <input type="email" bind:value={form.email.value} autocomplete="email" oninput={refresh} />
      </label>

      {#if form.mode.isParticipant}
        <label>
          Code d'accès
          <input
            class="code-input"
            bind:value={form.code.value}
            maxlength="8"
            autocomplete="one-time-code"
            inputmode="text"
            autocapitalize="characters"
            placeholder="8 caractères"
            oninput={refresh}
          />
        </label>
      {:else}
        <label>
          Mot de passe
          <input
            type="password"
            bind:value={form.password.value}
            autocomplete="current-password"
            oninput={refresh}
          />
        </label>
      {/if}

      <button onclick={submit} disabled={loading || !canSubmit}>
        {loading ? 'Connexion…' : 'Se connecter'}
      </button>
    {/if}
  </div>
</main>

<style>
  .login {
    min-height: 100vh;
    display: grid;
    place-items: center;
    padding: 1.5rem;
    background:
      radial-gradient(ellipse 80% 50% at 50% -20%, rgba(107, 76, 230, 0.25), transparent),
      var(--bg);
  }

  .card {
    width: 100%;
    max-width: 420px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 2rem;
  }

  .badge {
    margin: 0 0 0.5rem;
    font-size: 0.85rem;
    color: var(--muted);
  }

  h1 {
    margin: 0 0 1rem;
    font-size: 1.75rem;
  }

  .tabs {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .tabs button {
    flex: 1;
    padding: 0.6rem;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--muted);
    font-weight: 600;
  }

  .tabs button.active {
    background: var(--accent);
    border-color: var(--accent);
    color: white;
  }

  .lead {
    color: var(--muted);
    margin: 0 0 1.25rem;
    line-height: 1.5;
    font-size: 0.95rem;
  }

  label {
    display: block;
    margin-bottom: 1.25rem;
    font-weight: 500;
    font-size: 0.95rem;
  }

  input {
    display: block;
    width: 100%;
    margin-top: 0.5rem;
    padding: 0.85rem 1rem;
    font-size: 1.1rem;
    background: var(--bg);
    border: 2px solid var(--border);
    border-radius: 8px;
    color: var(--text);
  }

  .code-input {
    font-family: ui-monospace, monospace;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    font-size: 1.35rem;
    text-align: center;
  }

  button[type='button'].active,
  .card > button:last-child {
    width: 100%;
    padding: 1rem;
    background: var(--accent);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 1.1rem;
    font-weight: 600;
    margin-top: 0.25rem;
  }

  .card > button:last-child:disabled {
    opacity: 0.5;
  }

  .err {
    color: var(--danger);
    margin-bottom: 1rem;
  }

  .muted {
    color: var(--muted);
    text-align: center;
  }
</style>
