<script lang="ts">
  import type { PageData } from './$types.js';
  import type { Item } from '$lib/client/api.js';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import { formatScope } from '$lib/util/format-scope.js';
  import { formatCondition } from '$lib/util/format-condition.js';
  import { formatQuantity } from '$lib/util/format-quantity.js';
  import { conditionParamIds } from '$lib/util/condition-params.js';
  import strings from '$lib/strings.js';

  interface Props {
    data: PageData;
  }

  let { data }: Props = $props();

  let search = $state('');
  let categoryFilter = $state('');
  let parameterFilter = $state('');

  const categories = $derived(
    [...new Set(data.items.map((i) => i.category).filter((c): c is string => !!c))].sort()
  );

  const filtered = $derived.by(() => {
    const q = search.trim().toLowerCase();
    return data.items.filter((i) => {
      if (q && !i.display_name.toLowerCase().includes(q) && !i.id.toLowerCase().includes(q)) {
        return false;
      }
      if (categoryFilter && i.category !== categoryFilter) return false;
      if (parameterFilter && !conditionParamIds(i.include_when).includes(parameterFilter)) {
        return false;
      }
      return true;
    });
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
  <h2 class="title">
    {strings.nav.items}
    <span class="count ltr-number">({filtered.length})</span>
  </h2>

  <input
    type="search"
    class="search"
    placeholder={strings.items_catalog.search_placeholder}
    bind:value={search}
    aria-label={strings.items_catalog.search_placeholder}
  />

  <div class="filters">
    <label class="filter">
      <span>{strings.items_catalog.filter_category}</span>
      <select bind:value={categoryFilter}>
        <option value="">{strings.items_catalog.filter_all}</option>
        {#each categories as c (c)}
          <option value={c}>{c}</option>
        {/each}
      </select>
    </label>
    <label class="filter">
      <span>{strings.items_catalog.filter_parameter}</span>
      <select bind:value={parameterFilter}>
        <option value="">{strings.items_catalog.filter_all}</option>
        {#each data.parameters.filter((p) => !p.is_derived) as p (p.id)}
          <option value={p.id}>{p.display_name}</option>
        {/each}
      </select>
    </label>
  </div>

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
                  <span class="row-head">
                    <span class="name">{item.display_name}</span>
                    <span class="id ltr-number">{item.id}</span>
                  </span>
                  <span class="meta">{formatQuantity(item.quantity)} · {formatScope(item, data.names)}</span>
                  <span class="meta">{formatCondition(item.include_when, data.names)}</span>
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

  .title {
    font-size: var(--fs-title);
    font-weight: 700;
  }

  .count {
    color: var(--color-text-muted);
    font-weight: 400;
    font-size: var(--fs-row);
  }

  .filters {
    display: flex;
    gap: var(--space-3);
    flex-wrap: wrap;
  }

  .filter {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--fs-meta);
    color: var(--color-text-muted);
  }

  .filter select {
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    color: var(--color-text);
    font-size: var(--fs-meta);
  }

  .item {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    padding: var(--space-3) var(--space-4);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    color: var(--color-text);
  }

  .row-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-3);
  }

  .meta {
    font-size: var(--fs-meta);
    color: var(--color-text-muted);
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
