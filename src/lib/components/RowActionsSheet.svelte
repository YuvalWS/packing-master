<script lang="ts">
  import { Briefcase, StickyNote, Trash2 } from '@lucide/svelte';
  import BottomSheet from './BottomSheet.svelte';
  import Stepper from './Stepper.svelte';
  import { bagLabel } from '$lib/util/bag-label.js';
  import type { EnrichedItem } from '$lib/client/api.js';
  import strings from '$lib/strings.js';

  interface Props {
    item: EnrichedItem | null;
    knownBags: string[];
    onSaveNote: (item: EnrichedItem, notes: string | null) => Promise<void>;
    onSaveSplit: (item: EnrichedItem, distribution: Record<string, number> | null) => Promise<void>;
    onDelete: (item: EnrichedItem) => Promise<void>;
    onClose: () => void;
  }

  let { item, knownBags, onSaveNote, onSaveSplit, onDelete, onClose }: Props = $props();

  type View = 'menu' | 'bags' | 'note';
  let view = $state<View>('menu');
  let noteDraft = $state('');
  let splitDraft = $state<Record<string, number>>({});
  let busy = $state(false);

  $effect(() => {
    if (item) {
      view = 'menu';
      noteDraft = item.notes ?? '';
      splitDraft = initialSplit(item);
    }
  });

  function initialSplit(it: EnrichedItem): Record<string, number> {
    const existing = it.bag_distribution as Record<string, number> | null;
    const draft: Record<string, number> = {};
    for (const bag of bags(it)) {
      draft[bag] = existing?.[bag] ?? 0;
    }
    if (!existing) {
      const home = it.default_bag && draft[it.default_bag] !== undefined ? it.default_bag : bags(it)[0];
      if (home) draft[home] = it.count;
    }
    return draft;
  }

  function bags(it: EnrichedItem): string[] {
    const set = new Set<string>(['main_bag', ...knownBags]);
    if (it.default_bag) set.add(it.default_bag);
    for (const key of Object.keys(it.bag_distribution ?? {})) set.add(key);
    return [...set];
  }

  const splitTotal = $derived(Object.values(splitDraft).reduce((sum, n) => sum + n, 0));
  const splitValid = $derived(item !== null && splitTotal === item.count);

  async function run(action: () => Promise<void>) {
    busy = true;
    try {
      await action();
    } finally {
      busy = false;
    }
  }

  function saveNote() {
    if (!item) return;
    const it = item;
    const trimmed = noteDraft.trim();
    run(() => onSaveNote(it, trimmed === '' ? null : trimmed));
  }

  function saveSplit() {
    if (!item || !splitValid) return;
    const it = item;
    const nonZero = Object.entries(splitDraft).filter(([, n]) => n > 0);
    const singleDefault =
      nonZero.length === 1 && nonZero[0]![0] === (it.default_bag ?? 'main_bag');
    const distribution = singleDefault ? null : Object.fromEntries(nonZero);
    run(() => onSaveSplit(it, distribution));
  }

  function confirmDelete() {
    if (!item) return;
    const it = item;
    run(() => onDelete(it));
  }
</script>

<BottomSheet
  open={item !== null}
  title={view === 'bags'
    ? strings.row_menu.split_bags
    : view === 'note'
      ? strings.row_menu.note
      : item?.display_name ?? strings.row_menu.title}
  {onClose}
>
  {#if item}
    {#if view === 'menu'}
      <ul class="menu">
        <li>
          <button type="button" class="menu-item" onclick={() => (view = 'bags')}>
            <Briefcase size={20} />
            <span>{strings.row_menu.split_bags}</span>
          </button>
        </li>
        <li>
          <button type="button" class="menu-item" onclick={() => (view = 'note')}>
            <StickyNote size={20} />
            <span>{strings.row_menu.note}</span>
          </button>
        </li>
        <li>
          <button type="button" class="menu-item danger" disabled={busy} onclick={confirmDelete}>
            <Trash2 size={20} />
            <span>{strings.row_menu.delete}</span>
          </button>
        </li>
      </ul>
    {:else if view === 'bags'}
      <div class="pane">
        <ul class="bag-list">
          {#each Object.keys(splitDraft) as bag (bag)}
            <li class="bag-row">
              <span class="bag-name">{bagLabel(bag)}</span>
              <Stepper
                value={splitDraft[bag] ?? 0}
                min={0}
                onChange={(next) => (splitDraft = { ...splitDraft, [bag]: next })}
              />
            </li>
          {/each}
        </ul>
        <p class="hint" class:invalid={!splitValid}>
          {strings.row_menu.split_total_hint.replace('{count}', String(item.count))}
          <span class="ltr-number">({splitTotal}/{item.count})</span>
        </p>
        <button type="button" class="submit" disabled={!splitValid || busy} onclick={saveSplit}>
          {strings.common.save}
        </button>
      </div>
    {:else if view === 'note'}
      <div class="pane">
        <textarea
          rows="4"
          bind:value={noteDraft}
          placeholder={strings.row_menu.note_placeholder}
          aria-label={strings.row_menu.note}
        ></textarea>
        <button type="button" class="submit" disabled={busy} onclick={saveNote}>
          {strings.common.save}
        </button>
      </div>
    {/if}
  {/if}
</BottomSheet>

<style>
  .menu {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .menu-item {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    width: 100%;
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius-md);
    font-size: var(--fs-row);
    color: var(--color-text);
    cursor: pointer;
    text-align: start;
  }

  .menu-item:hover {
    background: var(--color-primary-soft);
  }

  .menu-item.danger {
    color: var(--color-danger);
  }

  .menu-item.danger:hover {
    background: var(--color-danger-soft);
  }

  .pane {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .bag-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .bag-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-2) var(--space-3);
    background: var(--color-bg);
    border-radius: var(--radius-md);
  }

  .bag-name {
    font-size: var(--fs-row);
  }

  .hint {
    font-size: var(--fs-meta);
    color: var(--color-text-muted);
  }

  .hint.invalid {
    color: var(--color-warning);
  }

  textarea {
    padding: var(--space-3);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    resize: vertical;
    font: inherit;
  }

  .submit {
    padding: var(--space-3) var(--space-5);
    border-radius: var(--radius-pill);
    background: var(--color-primary);
    color: white;
    font-weight: 600;
    cursor: pointer;
  }

  .submit:hover:not(:disabled) {
    background: #1d4ed8;
  }

  .submit:disabled {
    opacity: 0.5;
    cursor: default;
  }





</style>
