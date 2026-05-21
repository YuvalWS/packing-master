<script lang="ts">
  import type { PageData } from './$types.js';
  import { invalidate } from '$app/navigation';
  import { Settings } from '@lucide/svelte';
  import PackingListRow from '$lib/components/PackingListRow.svelte';
  import CategoryGroup from '$lib/components/CategoryGroup.svelte';
  import ProgressCounter from '$lib/components/ProgressCounter.svelte';
  import ParamChip from '$lib/components/ParamChip.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import Toast from '$lib/components/Toast.svelte';
  import type { EnrichedItem } from '$lib/client/api.js';
  import { makeApi } from '$lib/client/api.js';
  import strings from '$lib/strings.js';

  interface Props {
    data: PageData;
  }

  let { data }: Props = $props();

  // svelte-ignore state_referenced_locally
  let items = $state<EnrichedItem[]>(data.items);
  let toastMsg = $state<string | null>(null);
  let toastTone = $state<'info' | 'success' | 'danger'>('info');

  $effect(() => {
    items = data.items;
  });

  const parametersById = $derived(new Map(data.parameters.map((p) => [p.id, p])));

  const stats = $derived.by(() => {
    let totalRequired = 0;
    let checkedRequired = 0;
    let uncheckedOptional = 0;
    for (const it of items) {
      if (it.is_optional) {
        if (!it.is_checked) uncheckedOptional += 1;
      } else {
        totalRequired += 1;
        if (it.is_checked) checkedRequired += 1;
      }
    }
    return { totalRequired, checkedRequired, uncheckedOptional };
  });

  const groupedByCategory = $derived.by(() => {
    const groups = new Map<string, EnrichedItem[]>();
    for (const it of items) {
      const key = it.category ?? '__';
      const list = groups.get(key) ?? [];
      list.push(it);
      groups.set(key, list);
    }
    for (const list of groups.values()) {
      list.sort((a, b) => a.display_name.localeCompare(b.display_name));
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  });

  function showToast(msg: string, tone: 'info' | 'success' | 'danger' = 'info') {
    toastTone = tone;
    toastMsg = msg;
  }

  async function patchItem(item: EnrichedItem, patch: { is_checked?: boolean; count?: number }) {
    const previous = { ...item };
    Object.assign(item, patch);
    items = items.map((it) => (it.row_id === item.row_id ? { ...item } : it));
    try {
      const api = makeApi();
      const key = item.item_id ?? item.row_id;
      await api.patchTripItem(data.trip.id, key, patch);
      await invalidate(`trip:${data.trip.id}`);
    } catch {
      Object.assign(item, previous);
      items = items.map((it) => (it.row_id === item.row_id ? { ...previous } : it));
      showToast(strings.packing_list.save_failed, 'danger');
    }
  }
</script>

<header class="trip-head">
  <div class="title-row">
    <h2 class="trip-name">
      {data.trip.name ?? `${data.trip.start_date} – ${data.trip.end_date}`}
    </h2>
    <a class="settings-link" href={`/trips/${data.trip.id}/settings`} aria-label={strings.a11y.settings}>
      <Settings size={20} />
    </a>
  </div>
  <p class="dates ltr-number">{data.trip.start_date} – {data.trip.end_date}</p>

  {#if data.trip.context.parameters.length > 0}
    <ul class="param-chips">
      {#each data.trip.context.parameters as pid (pid)}
        {@const p = parametersById.get(pid)}
        {#if p && !p.is_derived}
          <li><ParamChip label={p.display_name} active /></li>
        {/if}
      {/each}
    </ul>
  {/if}

  <ProgressCounter
    checkedRequired={stats.checkedRequired}
    totalRequired={stats.totalRequired}
    uncheckedOptional={stats.uncheckedOptional}
  />
</header>

{#if items.length === 0}
  <EmptyState
    title={strings.packing_list.empty_title}
    message={strings.packing_list.empty_message}
  >
    {#snippet action()}
      <a class="cta" href={`/trips/${data.trip.id}/settings`}>
        <Settings size={18} />
        <span>{strings.packing_list.settings_cta}</span>
      </a>
    {/snippet}
  </EmptyState>
{:else}
  <div class="groups">
    {#each groupedByCategory as [category, rows] (category)}
      <CategoryGroup
        title={category === '__' ? strings.packing_list.category_uncategorized : category}
        count={rows.length}
      >
        {#each rows as item (item.row_id)}
          <PackingListRow
            {item}
            onToggleCheck={() => patchItem(item, { is_checked: !item.is_checked })}
            onCountChange={(next) => patchItem(item, { count: next })}
          />
        {/each}
      </CategoryGroup>
    {/each}
  </div>
{/if}

<Toast message={toastMsg} tone={toastTone} onDismiss={() => (toastMsg = null)} />

<style>
  .trip-head {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding-block-end: var(--space-4);
    border-block-end: 1px solid var(--color-border);
    margin-block-end: var(--space-4);
  }

  .title-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-3);
  }

  .trip-name {
    font-size: var(--fs-title);
    font-weight: 700;
  }

  .dates {
    color: var(--color-text-muted);
    font-size: var(--fs-meta);
  }

  .settings-link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: var(--radius-md);
    color: var(--color-text-muted);
  }

  .settings-link:hover {
    background: var(--color-primary-soft);
    color: var(--color-primary);
    text-decoration: none;
  }

  .param-chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1);
    padding-block: var(--space-2);
  }

  .groups {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }

  .cta {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-5);
    border-radius: var(--radius-pill);
    background: var(--color-primary);
    color: white;
  }

  .cta:hover {
    text-decoration: none;
    background: #1d4ed8;
  }
</style>
