<script lang="ts">
  import { Plus, RefreshCw, AlertTriangle } from '@lucide/svelte';
  import Modal from './Modal.svelte';
  import type {
    PatchTripDiffAdded,
    PatchTripDiffUpdated,
    PatchTripDiffRemoved,
    OrphanChoice,
    OrphanDecisions
  } from '$lib/client/api.js';
  import strings from '$lib/strings.js';

  interface Props {
    open: boolean;
    added: PatchTripDiffAdded[];
    updated: PatchTripDiffUpdated[];
    toBeRemoved: PatchTripDiffRemoved[];
    onConfirm: (decisions: OrphanDecisions) => void;
    onCancel: () => void;
  }

  let { open, added, updated, toBeRemoved, onConfirm, onCancel }: Props = $props();

  const checkedRemovalCount = $derived(toBeRemoved.filter((r) => r.is_checked).length);

  // Per item that no longer fits: remove (default), keep, or keep and mark packed (DESIGN.md 14.3).
  const CHOICES: OrphanChoice[] = ['remove', 'keep', 'pack'];
  const label: Record<OrphanChoice, string> = {
    remove: strings.regen.choice_remove,
    keep: strings.regen.choice_keep,
    pack: strings.regen.choice_pack
  };
  const keyOf = (r: PatchTripDiffRemoved) => (r.row_id !== null ? String(r.row_id) : `${r.item_id}|${r.person_id ?? ''}`);

  let choices = $state<Record<string, OrphanChoice>>({});

  $effect(() => {
    if (open) {
      choices = Object.fromEntries(toBeRemoved.map((r) => [keyOf(r), 'remove' as OrphanChoice]));
    }
  });

  function setAll(choice: OrphanChoice) {
    choices = Object.fromEntries(toBeRemoved.map((r) => [keyOf(r), choice]));
  }

  function confirm() {
    const pick = (c: OrphanChoice) => toBeRemoved.filter((r) => (choices[keyOf(r)] ?? 'remove') === c);
    onConfirm({ remove: pick('remove'), keep: pick('keep'), pack: pick('pack') });
  }
</script>

<Modal {open} title={strings.regen.title} onClose={onCancel}>
  {#if added.length > 0}
    <section class="diff-section">
      <h3><Plus size={16} aria-hidden="true" /> {strings.regen.added_heading}</h3>
      <ul>
        {#each added as a (`${a.item_id}|${a.person_id ?? ''}`)}
          <li>
            <span class="name">{a.display_name}{#if a.person_name}<span class="person"> · {a.person_name}</span>{/if}</span>
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
        {#each updated as u (`${u.item_id}|${u.person_id ?? ''}`)}
          <li>
            <span class="name">{u.display_name}{#if u.person_name}<span class="person"> · {u.person_name}</span>{/if}</span>
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
        {#each toBeRemoved as r (keyOf(r))}
          {@const k = keyOf(r)}
          <li class="orphan">
            <div class="row-label">
              <span class="name">{r.display_name}{#if r.person_name}<span class="person"> · {r.person_name}</span>{/if}</span>
              {#if r.is_checked}
                <span class="checked-tag">✓ {strings.regen.was_checked_tag}</span>
              {/if}
              <span class="count ltr-number">× {r.count}</span>
            </div>
            <div class="choices" role="radiogroup" aria-label={strings.regen.choice_group.replace('{name}', r.display_name)}>
              {#each CHOICES as c (c)}
                <button
                  type="button"
                  role="radio"
                  aria-checked={choices[k] === c}
                  class="choice"
                  class:selected={choices[k] === c}
                  data-choice={c}
                  onclick={() => (choices = { ...choices, [k]: c })}
                >
                  {label[c]}
                </button>
              {/each}
            </div>
          </li>
        {/each}
      </ul>
      {#if toBeRemoved.length > 1}
        <div class="apply-all">
          <span>{strings.regen.apply_all}</span>
          {#each CHOICES as c (c)}
            <button type="button" class="choice" onclick={() => setAll(c)}>{label[c]}</button>
          {/each}
        </div>
      {/if}
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
    <button type="button" class="danger" onclick={confirm}>
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


  .person {
    color: var(--color-text-muted);
    font-weight: 400;
  }

  .orphan {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    padding-block: var(--space-2);
  }

  .choices,
  .apply-all {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-1);
  }

  .apply-all {
    margin-block-start: var(--space-2);
    color: var(--color-text-muted);
    font-size: var(--fs-meta);
  }

  .choice {
    padding: 4px 12px;
    border-radius: var(--radius-pill);
    border: 1px solid var(--color-border);
    background: var(--color-surface);
    color: var(--color-text);
    font-size: var(--fs-meta);
    cursor: pointer;
  }

  .choice.selected {
    background: var(--color-primary);
    border-color: var(--color-primary);
    color: white;
  }
</style>
