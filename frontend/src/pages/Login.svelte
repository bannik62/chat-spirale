<script>
  import { onMount } from 'svelte';
  import { adminSessionFetch, sessionFetch, getAdminToken, setAdminToken } from '../lib/api.js';
  import { logAction, logError, logApi, logApiOk, logApiErr } from '../lib/debugLog.js';

  /** @type {'participant' | 'admin'} */
  let mode = $state('participant');
  let email = $state('');
  let code = $state('');
  let password = $state('');
  let error = $state('');
  let loading = $state(false);
  let checking = $state(true);

  let isParticipant = $derived(mode === 'participant');
  let isAdminMode = $derived(mode === 'admin');

  let canSubmit = $derived.by(() => {
    const e = email.trim().toLowerCase();
    if (!e.includes('@') || !e.includes('.')) return false;
    if (mode === 'participant') {
      const c = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      return c.length >= 7;
    }
    return password.length > 0;
  });

  function normalizeCode(raw) {
    return String(raw).trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  }

  function buildPayload() {
    const payload = {
      email: email.trim().toLowerCase(),
      mode,
    };
    if (mode === 'admin') {
      return { ...payload, password };
    }
    return { ...payload, code: normalizeCode(code) };
  }

  function validationError() {
    const e = email.trim().toLowerCase();
    if (!e) return 'Email requis';
    if (!e.includes('@') || !e.includes('.')) return 'Email invalide';
    if (mode === 'participant') {
      const c = normalizeCode(code);
      if (!c) return 'Code requis';
      if (c.length < 7) return 'Code à 8 caractères';
    } else if (!password) {
      return 'Mot de passe requis';
    }
    return null;
  }

  onMount(async () => {
    logAction('Login', 'page mount');
    const params = new URLSearchParams(window.location.search);
    const urlMode = params.get('mode');
    const stored = sessionStorage.getItem('spirale_login_mode');
    if (urlMode === 'admin' || stored === 'admin') {
      mode = 'admin';
      sessionStorage.removeItem('spirale_login_mode');
      logAction('Login', 'mode preset', { source: urlMode ? 'url' : 'session' });
    }

    try {
      const session = getAdminToken()
        ? await adminSessionFetch('/session')
        : await sessionFetch('/session');
      logAction('Login', 'session check', { role: session.role });
      if (session.role === 'admin') {
        location.replace('/admin');
        return;
      }
      if (session.role === 'participant') {
        location.replace('/mes-activites');
        return;
      }
    } catch {
      /* pas connecté */
    }
    checking = false;
  });

  /** @param {'participant' | 'admin'} next */
  function setMode(next) {
    logAction('Login', 'change mode', { mode: next });
    mode = next;
    error = '';
  }

  async function submit() {
    error = '';
    const err = validationError();
    if (err) {
      error = err;
      logAction('Login', 'submit blocked validation', { error: err });
      return;
    }
    logAction('Login', 'submit', { mode, email: email.trim().toLowerCase() });
    loading = true;
    try {
      const payload = buildPayload();
      logApi('POST', '/auth/portal-login', payload);
      const res = await fetch('/api/auth/portal-login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        logApiErr('POST', '/auth/portal-login', data.error);
        throw new Error(data.error);
      }
      logApiOk('POST', '/auth/portal-login', { role: data.role, redirect: data.redirect });

      logAction('Login', 'submit success', { role: data.role, redirect: data.redirect });

      if (data.role === 'admin') {
        if (data.token) setAdminToken(data.token);
        location.href = data.redirect || '/admin';
        return;
      }

      setAdminToken(null);
      location.href = '/mes-activites';
    } catch (e) {
      logError('Login', 'submit', e);
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
          class:active={isParticipant}
          onclick={() => setMode('participant')}
        >
          Participant
        </button>
        <button
          type="button"
          class:active={isAdminMode}
          onclick={() => setMode('admin')}
        >
          Formateur
        </button>
      </div>

      <p class="lead">
        {#if isParticipant}
          Votre email et le code reçu par l'association.
        {:else}
          Votre email et votre mot de passe formateur.
        {/if}
      </p>

      {#if error}<p class="err">{error}</p>{/if}

      <label>
        Email
        <input type="email" bind:value={email} autocomplete="email" />
      </label>

      {#if isParticipant}
        <label>
          Code d'accès
          <input
            class="code-input"
            bind:value={code}
            maxlength="8"
            autocomplete="one-time-code"
            inputmode="text"
            autocapitalize="characters"
            placeholder="8 caractères"
            oninput={() => {
              code = normalizeCode(code);
            }}
          />
        </label>
      {:else}
        <label>
          Mot de passe
          <input type="password" bind:value={password} autocomplete="current-password" />
        </label>
      {/if}

      <button
        type="button"
        class="submit-btn"
        onclick={submit}
        disabled={loading || !canSubmit}
      >
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
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s, color 0.15s;
  }

  .tabs button:hover:not(.active) {
    border-color: var(--accent-hover);
    color: var(--text);
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

  .submit-btn {
    width: 100%;
    padding: 1rem;
    background: var(--accent);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 1.1rem;
    font-weight: 600;
    margin-top: 0.25rem;
    cursor: pointer;
    transition: background 0.15s, transform 0.1s;
  }

  .submit-btn:hover:not(:disabled) {
    background: var(--accent-hover);
  }

  .submit-btn:active:not(:disabled) {
    transform: scale(0.98);
  }

  .submit-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
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
