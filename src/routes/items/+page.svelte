<script lang="ts">
  import type { PageData } from './$types.js';
  import type { Item } from '$lib/client/api.js';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import strings from '$lib/strings.js';

  interface Props {
    data: PageData;
  }

  let { data }: Props = $props();

  let search = $state('');

  const filtered = $derived.by(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data.items;
    return data.items.filter(
      (i) => i.display_name.toLowerCase().includes(q) || i.id.toLowerCase().includes(q)
    );
  });

  const grouped = $derived.by(() => {
    const map = new Map<string, Item[]>();
    for (const it of filtered) {
      const key = it.category ?? '__';
      const list = map.get(key) ?? [];
      list.push(it);
      map.set(key, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.display_name.localeCompare(b.display_name));
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  });
</script>

<section class="screen">
  <input
    type="search"
    class="search"
    placeholder={strings.items_catalog.search_placeholder}
    bind:value={search}
    aria-label={strings.items_catalog.search_placeholder}
  />

  {#if filtered.length === 0}
    <EmptyState title={strings.items_catalog.no_results} />
  {:else}
    <div class="groups">
      {#each grouped as [category, items] (category)}
        <section class="group">
          <h3>{category === '__' ? strings.packing_list.category_uncategorized : category}</h3>
          <ul>
            {#each items as item (item.id)}
              <li>
                <a class="item" href="/items/{item.id}">
                  <span class="name">{item.display_name}</span>
                  <span class="id ltr-number">{item.id}</span>
                </a>
              </li>
            {/each}
          </ul>
        </section>
      {/each}
    </div>
  {/if}
</section>

<style>
  .screen {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    padding-block-start: var(--space-3);
  }

  .search {
    padding: var(--space-3);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    font-size: var(--fs-body);
  }

  .search:focus {
    outline: none;
    border-color: var(--color-primary);
  }

  .groups {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }

  .group {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  h3 {
    font-size: var(--fs-meta);
    font-weight: 700;
    text-transform: uppercase;
    color: var(--color-text-muted);
    padding-inline: var(--space-2);
  }

  ul {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-3) var(--space-4);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    color: var(--color-text);
  }

  .item:hover {
    text-decoration: none;
    border-color: var(--color-primary);
  }

  .name {
    font-size: var(--fs-row);
  }

  .id {
    font-size: var(--fs-meta);
    color: var(--color-text-muted);
  }
</style>
