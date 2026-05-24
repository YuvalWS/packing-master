<script lang="ts">
  import BottomSheet from './BottomSheet.svelte';
  import type { Item } from '$lib/client/api.js';
  import { makeApi, ClientApiError } from '$lib/client/api.js';
  import strings from '$lib/strings.js';

  interface Props {
    open: boolean;
    tripId: number;
    existingItemIds: Set<string>;
    onAdded: () => void;
    onClose: () => void;
    onError: (msg: string) => void;
  }

  let { open, tripId, existingItemIds, onAdded, onClose, onError }: Props = $props();

  let tab = $state<'catalog' | 'free_text'>('catalog');
  let catalog = $state<Item[]>([]);
  let catalogLoaded = $state(false);
  let search = $state('');
  let freeText = $state('');
  let freeTextCount = $state(1);
  let submitting = $state(false);

  $effect(() => {
    if (open && !catalogLoaded) {
      void loadCatalog();
    }
    if (!open) {
      search = '';
      freeText = '';
      freeTextCount = 1;
      tab = 'catalog';
    }
  });

  async function loadCatalog() {
    const api = makeApi();
    const res = await api.listItems();
    catalog = res.items;
    catalogLoaded = true;
  }

  const filtered = $derived.by(() => {
    const q = search.trim().toLowerCase();
    return catalog
      .filter((i) => !existingItemIds.has(i.id))
      .filter((i) => !q || i.display_name.toLowerCase().includes(q) || i.id.toLowerCase().includes(q))
      .slice(0, 40);
  });

  async function addCatalog(item: Item) {
    submitting = true;
    try {
      const api = makeApi();
      await api.addCatalogItem(tripId, { item_id: item.id });
      onAdded();
    } catch (err) {
      if (err instanceof ClientApiError && err.status === 409) {
        onError(strings.manual_add.already_in_trip);
      } else {
        onError(strings.manual_add.add_failed);
      }
    } finally {
      submitting = false;
    }
  }

  async function addFreeText() {
    const name = freeText.trim();
    if (!name) {
      onError(strings.manual_add.free_text_empty);
      return;
    }
    submitting = true;
    try {
      const api = makeApi();
      await api.addFreeTextItem(tripId, { display_name: name, count: freeTextCount });
      onAdded();
    } catch {
      onError(strings.manual_add.add_failed);
    } finally {
      submitting = false;
    }
  }
</script>

<BottomSheet {open} title={strings.manual_add.title} {onClose}>
  <div class="tabs" role="tablist">
    <button
      type="button"
      role="tab"
      aria-selected={tab === 'catalog'}
      class:active={tab === 'catalog'}
      onclick={() => (tab = 'catalog')}
    >
      {strings.manual_add.tab_catalog}
    </button>
    <button
      type="button"
      role="tab"
      aria-selected={tab === 'free_text'}
      class:active={tab === 'free_text'}
      onclick={() => (tab = 'free_text')}
    >
      {strings.manual_add.tab_free_text}
    </button>
  </div>

  {#if tab === 'catalog'}
    <input
      type="search"
      class="input"
      placeholder={strings.manual_add.search_placeholder}
      bind:value={search}
      aria-label={strings.manual_add.search_placeholder}
    />
    {#if filtered.length === 0}
      <p class="empty">{strings.manual_add.no_results}</p>
    {:else}
      <ul class="results">
        {#each filtered as item (item.id)}
          <li>
            <button type="button" class="result" onclick={() => addCatalog(item)} disabled={submitting}>
              <span class="result-name">{item.display_name}</span>
              {#if item.category}
                <span class="result-category">{item.category}</span>
              {/if}
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  {:else}
    <form
      class="free-form"
      onsubmit={(e) => {
        e.preventDefault();
        addFreeText();
      }}
    >
      <label class="field">
        <span>{strings.manual_add.free_text_placeholder}</span>
        <input type="text" class="input" bind:value={freeText} required />
      </label>
      <label class="field">
        <span>{strings.manual_add.count_label}</span>
        <input
          type="number"
          min="1"
          class="input ltr-number"
          bind:value={freeTextCount}
        />
      </label>
      <button type="submit" class="submit" disabled={submitting}>
        {submitting ? strings.common.loading : strings.manual_add.submit}
      </button>
    </form>
  {/if}
</BottomSheet>

<style>
  .tabs {
    display: flex;
    gap: var(--space-2);
    margin-block-end: var(--space-3);
  }

  .tabs button {
    padding: var(--space-2) var(--space-4);
    border-radius: var(--radius-pill);
    background: var(--color-bg);
    color: var(--color-text-muted);
    cursor: pointer;
    font-size: var(--fs-meta);
  }

  .tabs button.active {
    background: var(--color-primary);
    color: white;
  }

  .input {
    width: 100%;
    padding: var(--space-3);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    font-size: var(--fs-body);
  }

  .input:focus {
    outline: none;
    border-color: var(--color-primary);
  }

  .results {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    margin-block-start: var(--space-3);
  }

  .result {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    padding: var(--space-3) var(--space-4);
    background: var(--color-bg);
    border-radius: var(--radius-md);
    cursor: pointer;
    text-align: start;
  }

  .result:hover:not(:disabled) {
    background: var(--color-primary-soft);
  }

  .result-name {
    font-size: var(--fs-row);
  }

  .result-category {
    font-size: var(--fs-meta);
    color: var(--color-text-muted);
  }

  .empty {
    padding-block: var(--space-5);
    text-align: center;
    color: var(--color-text-muted);
  }

  .free-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .field > span {
    font-size: var(--fs-meta);
    color: var(--color-text-muted);
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
</style>
