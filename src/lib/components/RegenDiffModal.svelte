<script lang="ts">
  import { Plus, RefreshCw, AlertTriangle } from '@lucide/svelte';
  import Modal from './Modal.svelte';
  import type {
    PatchTripDiffAdded,
    PatchTripDiffUpdated,
    PatchTripDiffRemoved
  } from '$lib/client/api.js';
  import strings from '$lib/strings.js';

  interface Props {
    open: boolean;
    added: PatchTripDiffAdded[];
    updated: PatchTripDiffUpdated[];
    toBeRemoved: PatchTripDiffRemoved[];
    onConfirm: (selectedRemovals: PatchTripDiffRemoved[]) => void;
    onCancel: () => void;
  }

  let { open, added, updated, toBeRemoved, onConfirm, onCancel }: Props = $props();

  const checkedRemovalCount = $derived(toBeRemoved.filter((r) => r.is_checked).length);

  // svelte-ignore state_referenced_locally
  let selectedRowIds = $state<Set<number>>(new Set(toBeRemoved.map((r) => r.row_id ?? -1)));

  $effect(() => {
    if (open) {
      selectedRowIds = new Set(toBeRemoved.map((r) => r.row_id ?? -1));
    }
  });

  function toggleRow(rowId: number) {
    const next = new Set(selectedRowIds);
    if (next.has(rowId)) next.delete(rowId);
    else next.add(rowId);
    selectedRowIds = next;
  }

  function confirm() {
    const picks = toBeRemoved.filter((r) => r.row_id !== null && selectedRowIds.has(r.row_id));
    onConfirm(picks);
  }
</script>

<Modal {open} title={strings.regen.title} onClose={onCancel}>
  {#if added.length > 0}
    <section class="diff-section">
      <h3><Plus size={16} aria-hidden="true" /> {strings.regen.added_heading}</h3>
      <ul>
        {#each added as a (a.item_id)}
          <li>
            <span class="name">{a.display_name}</span>
            <span class="count ltr-number">× {a.count}</span>
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  {#if updated.length > 0}
    <section class="diff-section">
      <h3><RefreshCw size={16} aria-hidden="true" /> {strings.regen.updated_heading}</h3>
      <ul>
        {#each updated as u (u.item_id)}
          <li>
            <span class="name">{u.display_name}</span>
            {#if u.count_preserved}
              <span class="note">{strings.regen.count_preserved_note.replace('{count}', String(u.new_count))}</span>
            {:else if u.previous_count !== u.new_count}
              <span class="count ltr-number">{u.previous_count} → {u.new_count}</span>
            {:else}
              <span class="count ltr-number">× {u.new_count}</span>
            {/if}
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  {#if toBeRemoved.length > 0}
    <section class="diff-section warn">
      <h3><AlertTriangle size={16} aria-hidden="true" /> {strings.regen.removed_heading}</h3>
      <ul>
        {#each toBeRemoved as r (r.row_id ?? r.item_id)}
          {@const rowId = r.row_id ?? -1}
          <li>
            <label class="row-label">
              <input
                type="checkbox"
                checked={rowId >= 0 && selectedRowIds.has(rowId)}
                disabled={rowId < 0}
                onchange={() => rowId >= 0 && toggleRow(rowId)}
              />
              <span class="name">{r.display_name}</span>
              {#if r.is_checked}
                <span class="checked-tag">✓ {strings.regen.was_checked_tag}</span>
              {/if}
              <span class="count ltr-number">× {r.count}</span>
            </label>
          </li>
        {/each}
      </ul>
      {#if checkedRemovalCount > 0}
        <p class="checked-warning">
          {checkedRemovalCount === 1
            ? strings.regen.checked_warning_one
            : strings.regen.checked_warning_many.replace('{count}', String(checkedRemovalCount))}
        </p>
      {/if}
    </section>
  {/if}

  {#snippet footer()}
    <button type="button" class="ghost" onclick={onCancel}>
      {strings.regen.cancel}
    </button>
    <button type="button" class="danger" onclick={confirm} disabled={selectedRowIds.size === 0}>
      {strings.regen.confirm}
    </button>
  {/snippet}
</Modal>

<style>
  .diff-section + .diff-section {
    margin-block-start: var(--space-4);
  }

  h3 {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--fs-meta);
    font-weight: 700;
    text-transform: uppercase;
    color: var(--color-text-muted);
    margin-block-end: var(--space-2);
  }

  .warn h3 {
    color: var(--color-danger);
  }

  ul {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  li {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    background: var(--color-bg);
    border-radius: var(--radius-md);
  }

  .row-label {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    flex: 1;
    cursor: pointer;
  }

  .name {
    flex: 1;
  }

  .count {
    color: var(--color-text-muted);
    font-variant-numeric: tabular-nums;
  }

  .note {
    font-size: var(--fs-meta);
    color: var(--color-text-muted);
  }

  .checked-tag {
    font-size: var(--fs-meta);
    color: var(--color-warning);
    white-space: nowrap;
  }

  .checked-warning {
    margin-block-start: var(--space-2);
    font-size: var(--fs-meta);
    color: var(--color-warning);
  }

  .ghost {
    padding: var(--space-2) var(--space-4);
    border-radius: var(--radius-pill);
    background: transparent;
    color: var(--color-text-muted);
    cursor: pointer;
  }

  .ghost:hover {
    background: var(--color-bg);
    color: var(--color-text);
  }

  .danger {
    padding: var(--space-2) var(--space-4);
    border-radius: var(--radius-pill);
    background: var(--color-danger);
    color: white;
    cursor: pointer;
  }

  .danger:hover:not(:disabled) {
    background: #b91c1c;
  }

  input[type='checkbox'] {
    accent-color: var(--color-danger);
  }
</style>
