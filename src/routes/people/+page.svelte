<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import type { PageData } from './$types.js';
  import Toast from '$lib/components/Toast.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import strings from '$lib/strings.js';
  import { makeApi, type Person } from '$lib/client/api.js';

  interface Props {
    data: PageData;
  }

  let { data }: Props = $props();

  const s = strings.people;
  const kinds = ['adult', 'kid', 'baby'] as const;
  const api = makeApi();

  let newName = $state('');
  let newKind = $state<Person['kind']>('adult');
  let editing = $state<{ id: string; name: string; kind: Person['kind'] } | null>(null);
  let removing = $state<Person | null>(null);
  let busy = $state(false);
  let toastMsg = $state<string | null>(null);
  let toastTone = $state<'info' | 'success' | 'danger'>('info');

  function toast(msg: string, tone: 'info' | 'success' | 'danger' = 'success') {
    toastTone = tone;
    toastMsg = msg;
  }

  // Ids are internal (the API and rules use them); names stay free-form Hebrew.
  function newId(): string {
    return `p_${Math.random().toString(36).slice(2, 8)}`;
  }

  async function run(action: () => Promise<unknown>, done: string) {
    busy = true;
    try {
      await action();
      await invalidateAll();
      toast(done);
    } catch {
      toast(s.failed, 'danger');
    } finally {
      busy = false;
    }
  }

  async function add(e: SubmitEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    await run(
      () => api.createPerson({ id: newId(), display_name: name, kind: newKind, sort_order: data.people.length * 10 }),
      s.added_toast
    );
    newName = '';
  }

  async function saveEdit(e: SubmitEvent) {
    e.preventDefault();
    if (!editing || !editing.name.trim()) return;
    const { id, name, kind } = editing;
    editing = null;
    await run(() => api.patchPerson(id, { display_name: name.trim(), kind }), s.saved_toast);
  }

  async function confirmRemove() {
    if (!removing) return;
    const { id } = removing;
    removing = null;
    busy = true;
    try {
      const res = await api.deletePerson(id);
      await invalidateAll();
      toast(res.archived ? s.archived_toast : s.removed_toast);
    } catch {
      toast(s.failed, 'danger');
    } finally {
      busy = false;
    }
  }
</script>

<section class="screen">
  <p class="intro">{s.intro}</p>

  {#if data.people.length === 0}
    <EmptyState title={s.empty} />
  {:else}
    <ul class="list">
      {#each data.people as p (p.id)}
        <li class="card">
          {#if editing?.id === p.id}
            <form class="edit" onsubmit={saveEdit}>
              <input type="text" bind:value={editing.name} aria-label={s.name} required />
              <select bind:value={editing.kind} aria-label={s.kind}>
                {#each kinds as k (k)}
                  <option value={k}>{s.kinds[k]}</option>
                {/each}
              </select>
              <div class="row">
                <button type="button" class="ghost" onclick={() => (editing = null)}>{strings.common.cancel}</button>
                <button type="submit" class="primary" disabled={busy}>{s.save}</button>
              </div>
            </form>
          {:else if removing?.id === p.id}
            <div class="confirm">
              <p>{s.remove_confirm.replace('{name}', p.display_name)}</p>
              <div class="row">
                <button type="button" class="ghost" onclick={() => (removing = null)}>{strings.common.cancel}</button>
                <button type="button" class="danger-btn" onclick={confirmRemove}>{s.remove}</button>
              </div>
            </div>
          {:else}
            <div class="person">
              <span class="name">{p.display_name}</span>
              <span class="kind">{s.kinds[p.kind]}</span>
            </div>
            <div class="row">
              <button
                type="button"
                class="ghost"
                disabled={busy}
                onclick={() => (editing = { id: p.id, name: p.display_name, kind: p.kind })}
              >
                {s.edit}
              </button>
              <button type="button" class="ghost danger" disabled={busy} onclick={() => (removing = p)}>
                {s.remove}
              </button>
            </div>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}

  <form class="card add" onsubmit={add}>
    <h2>{s.add_heading}</h2>
    <label class="field">
      <span>{s.name}</span>
      <input type="text" bind:value={newName} required />
    </label>
    <label class="field">
      <span>{s.kind}</span>
      <select bind:value={newKind}>
        {#each kinds as k (k)}
          <option value={k}>{s.kinds[k]}</option>
        {/each}
      </select>
    </label>
    <div class="row">
      <button type="submit" class="primary" disabled={busy || !newName.trim()}>{s.add}</button>
    </div>
  </form>
</section>

<Toast message={toastMsg} tone={toastTone} onDismiss={() => (toastMsg = null)} />

<style>
  .screen {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    padding-block: var(--space-3) var(--space-6);
  }

  .intro {
    color: var(--color-text-muted);
    font-size: var(--fs-meta);
  }

  .list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .card {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
  }

  .card.add {
    flex-direction: column;
    align-items: stretch;
  }

  h2 {
    font-size: var(--fs-row);
    font-weight: 700;
  }

  .person {
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
  }

  .name {
    font-size: var(--fs-row);
    font-weight: 600;
  }

  .kind {
    color: var(--color-text-muted);
    font-size: var(--fs-meta);
  }

  .edit,
  .confirm {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    width: 100%;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  input,
  select {
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    font-size: var(--fs-body);
    background: var(--color-surface);
    color: var(--color-text);
  }

  .row {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
  }

  .primary,
  .ghost,
  .danger-btn {
    padding: var(--space-2) var(--space-4);
    border-radius: var(--radius-pill);
    cursor: pointer;
    font-size: var(--fs-body);
  }

  .primary {
    background: var(--color-primary);
    color: white;
  }

  .primary:disabled,
  .ghost:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .ghost {
    color: var(--color-primary);
    border: 1px solid var(--color-border);
  }

  .ghost.danger {
    color: var(--color-danger);
  }

  .danger-btn {
    background: var(--color-danger);
    color: white;
  }
</style>
