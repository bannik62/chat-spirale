<script>
  import { EmailListField, ParticipantSearchField } from './fields/index.js';
  import { touchForm } from './fields/reactive.js';
  import { logAction } from './debugLog.js';

  /**
   * @type {{
   *   allParticipants: Array<{ id: string, email: string, accessCode?: string, rooms?: Array<{name:string}> }>,
   *   pickList: string[],
   *   roomMemberEmails?: string[],
   * }}
   */
  let {
    allParticipants = [],
    pickList = $bindable([]),
    roomMemberEmails = [],
  } = $props();

  let searchField = $state(new ParticipantSearchField());
  let emailList = $state(new EmailListField(pickList));
  let dropdownOpen = $state(false);
  let inputEl = $state(null);

  function syncOut() {
    pickList = emailList.toJSON();
    emailList = touchForm(emailList);
  }

  $effect(() => {
    if (pickList.length === 0 && emailList.length > 0) {
      emailList.clear();
      emailList = touchForm(emailList);
    }
  });

  let filtered = $derived.by(() => {
    const q = searchField.value.toLowerCase();
    if (!q) {
      return allParticipants
        .filter((p) => !emailList.includes(p.email))
        .slice(0, 30);
    }
    return allParticipants
      .filter((p) => {
        if (emailList.includes(p.email)) return false;
        return (
          p.email.includes(q) ||
          p.rooms?.some((r) => r.name.toLowerCase().includes(q))
        );
      })
      .slice(0, 20);
  });

  let canAddNewEmail = $derived.by(() => {
    const candidate = searchField.candidateEmail;
    if (!candidate) return false;
    const exists = allParticipants.some((p) => p.email === candidate);
    return !exists && !emailList.includes(candidate);
  });

  function addEmail(email) {
    if (emailList.add(email)) {
      logAction('ParticipantPicker', 'addEmail', { email });
      searchField.reset();
      searchField = touchForm(searchField);
      syncOut();
    }
    dropdownOpen = false;
  }

  function removeEmail(email) {
    logAction('ParticipantPicker', 'removeEmail', { email });
    emailList.remove(email);
    syncOut();
  }

  function onInputFocus() {
    logAction('ParticipantPicker', 'search focus');
    dropdownOpen = true;
  }

  function onInputBlur() {
    setTimeout(() => {
      dropdownOpen = false;
    }, 200);
  }

  function onKeydown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (canAddNewEmail) addEmail(searchField.value);
      else if (filtered.length === 1) addEmail(filtered[0].email);
    }
    if (e.key === 'Escape') {
      logAction('ParticipantPicker', 'search escape');
      dropdownOpen = false;
    }
  }

  function inRoom(email) {
    return roomMemberEmails.includes(email);
  }
</script>

<div class="picker">
  <label class="search-label">
    Rechercher ou saisir un email
    <input
      bind:this={inputEl}
      type="search"
      bind:value={searchField.value}
      placeholder="Nom, email…"
      autocomplete="off"
      onfocus={onInputFocus}
      onblur={onInputBlur}
      onkeydown={onKeydown}
    />
  </label>

  {#if dropdownOpen && (filtered.length > 0 || canAddNewEmail)}
    <ul class="dropdown" role="listbox">
      {#if canAddNewEmail}
        <li>
          <button type="button" class="option new" onclick={() => addEmail(searchField.value)}>
            + Nouvel email : <strong>{searchField.candidateEmail}</strong>
          </button>
        </li>
      {/if}
      {#each filtered as p}
        <li>
          <button type="button" class="option" onclick={() => addEmail(p.email)}>
            <span class="option-email">{p.email}</span>
            {#if inRoom(p.email)}
              <span class="tag in-room">Déjà ici</span>
            {:else if p.rooms?.length}
              <span class="option-meta">{p.rooms.map((r) => r.name).join(' · ')}</span>
            {/if}
          </button>
        </li>
      {/each}
      {#if filtered.length === 0 && !canAddNewEmail && searchField.value}
        <li class="empty">Aucun résultat</li>
      {/if}
    </ul>
  {/if}

  {#if emailList.length > 0}
    <div class="chips">
      {#each emailList.items as email}
        <span class="chip">
          {email}
          <button type="button" class="chip-remove" onclick={() => removeEmail(email)} aria-label="Retirer"
            >×</button
          >
        </span>
      {/each}
    </div>
  {:else}
    <p class="hint">Choisissez dans la liste ou tapez un nouvel email puis Entrée.</p>
  {/if}
</div>

<style>
  .picker {
    position: relative;
  }

  .search-label {
    display: block;
    font-size: 0.9rem;
    font-weight: 500;
  }

  .search-label input {
    display: block;
    width: 100%;
    margin-top: 0.4rem;
    padding: 0.65rem 0.75rem;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--text);
    font-size: 1rem;
  }

  .dropdown {
    position: absolute;
    z-index: 50;
    left: 0;
    right: 0;
    max-height: 220px;
    overflow-y: auto;
    margin: 0.25rem 0 0;
    padding: 0.25rem;
    list-style: none;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
  }

  .option {
    width: 100%;
    text-align: left;
    padding: 0.55rem 0.65rem;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: var(--text);
    cursor: pointer;
  }

  .option:hover {
    background: var(--surface);
  }

  .option.new {
    color: var(--success);
    border-bottom: 1px solid var(--border);
    margin-bottom: 0.25rem;
    border-radius: 6px 6px 0 0;
  }

  .option-email {
    display: block;
    font-weight: 500;
  }

  .option-meta {
    display: block;
    font-size: 0.75rem;
    color: var(--muted);
    margin-top: 0.15rem;
  }

  .tag {
    display: inline-block;
    font-size: 0.7rem;
    padding: 0.1rem 0.4rem;
    border-radius: 4px;
    margin-top: 0.2rem;
  }

  .tag.in-room {
    background: var(--surface);
    color: var(--muted);
  }

  .empty {
    padding: 0.75rem;
    color: var(--muted);
    font-size: 0.85rem;
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 0.75rem;
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.35rem 0.5rem 0.35rem 0.65rem;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 999px;
    font-size: 0.85rem;
  }

  .chip-remove {
    background: transparent;
    border: none;
    color: var(--muted);
    font-size: 1.1rem;
    line-height: 1;
    padding: 0 0.2rem;
    cursor: pointer;
  }

  .chip-remove:hover {
    color: var(--danger);
  }

  .hint {
    margin: 0.5rem 0 0;
    font-size: 0.8rem;
    color: var(--muted);
  }
</style>
