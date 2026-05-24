<script lang="ts">
  import type { PageData } from './$types.js';
  import { invalidate } from '$app/navigation';
  import { Settings } from '@lucide/svelte';
  import PackingListRow from '$lib/components/PackingListRow.svelte';
  import KitComponentRow from '$lib/components/KitComponentRow.svelte';
  import CategoryGroup from '$lib/components/CategoryGroup.svelte';
  import ProgressCounter from '$lib/components/ProgressCounter.svelte';
  import ParamChip from '$lib/components/ParamChip.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import Toast from '$lib/components/Toast.svelte';
  import BagFilterToggle from '$lib/components/BagFilterToggle.svelte';
  import CheckedToBottomToggle from '$lib/components/CheckedToBottomToggle.svelte';
  import ManualAddSheet from '$lib/components/ManualAddSheet.svelte';
  import Fab from '$lib/components/Fab.svelte';
  import { Plus } from '@lucide/svelte';
  import type { EnrichedItem, KitComponentRow as KitComponentRowState } from '$lib/client/api.js';
  import { makeApi } from '$lib/client/api.js';
  import { loadPrefs, savePrefs, type ViewMode } from '$lib/client/view-prefs.js';
  import { formatDateRange } from '$lib/util/format-date.js';
  import strings from '$lib/strings.js';

  interface Props {
    data: PageData;
  }

  let { data }: Props = $props();

  // svelte-ignore state_referenced_locally
  let items = $state<EnrichedItem[]>(data.items);
  // svelte-ignore state_referenced_locally
  let kitComponents = $state<KitComponentRowState[]>(data.kitComponents);
  let toastMsg = $state<string | null>(null);
  let toastTone = $state<'info' | 'success' | 'danger'>('info');
  let expandedKits = $state<Set<number>>(new Set());
  let addSheetOpen = $state(false);

  const existingItemIds = $derived(
    new Set(items.map((it) => it.item_id).filter((id): id is string => !!id))
  );
  let viewMode = $state<ViewMode>('category');
  let checkedToBottom = $state(false);

  $effect(() => {
    const prefs = loadPrefs(data.trip.id);
    viewMode = prefs.mode;
    checkedToBottom = prefs.checkedToBottom;
  });

  function setViewMode(next: ViewMode) {
    viewMode = next;
    savePrefs(data.trip.id, { mode: viewMode, checkedToBottom });
  }

  function setCheckedToBottom(next: boolean) {
    checkedToBottom = next;
    savePrefs(data.trip.id, { mode: viewMode, checkedToBottom });
  }

  $effect(() => {
    items = data.items;
    kitComponents = data.kitComponents;
  });

  function kitState(itemId: string) {
    const checks = kitComponents.filter((c) => c.kit_item_id === itemId);
    return checks;
  }

  function kitPartial(item: EnrichedItem): boolean {
    if (!item.is_kit || !item.kit_contents) return false;
    const states = kitState(item.item_id ?? '');
    const checkedCount = states.filter((s) => s.is_checked).length;
    return checkedCount > 0 && checkedCount < item.kit_contents.length;
  }

  function isComponentChecked(itemId: string, componentId: string): boolean {
    return kitComponents.some(
      (c) => c.kit_item_id === itemId && c.component_id === componentId && c.is_checked
    );
  }

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

  const grouped = $derived.by(() => {
    const groups = new Map<string, EnrichedItem[]>();
    for (const it of items) {
      const key = groupKey(it);
      const list = groups.get(key) ?? [];
      list.push(it);
      groups.set(key, list);
    }
    for (const list of groups.values()) {
      list.sort((a, b) => {
        if (checkedToBottom && a.is_checked !== b.is_checked) {
          return a.is_checked ? 1 : -1;
        }
        return a.display_name.localeCompare(b.display_name);
      });
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  });

  function groupKey(it: EnrichedItem): string {
    if (viewMode === 'bag') {
      return it.default_bag ?? '__no_bag';
    }
    return it.category ?? '__no_category';
  }

  function groupLabel(rawKey: string): string {
    if (viewMode === 'bag') {
      if (rawKey === '__no_bag') return strings.view.no_bag;
      if (rawKey === 'main_bag') return strings.view.bag_main;
      return rawKey;
    }
    if (rawKey === '__no_category') return strings.packing_list.category_uncategorized;
    return rawKey;
  }

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

  function toggleKitExpand(rowId: number) {
    const next = new Set(expandedKits);
    if (next.has(rowId)) next.delete(rowId);
    else next.add(rowId);
    expandedKits = next;
  }

  async function toggleComponent(itemId: string, componentId: string) {
    const previousChecked = isComponentChecked(itemId, componentId);
    kitComponents = updateComponent(kitComponents, itemId, componentId, !previousChecked);
    try {
      const api = makeApi();
      await api.toggleKitComponent(data.trip.id, itemId, componentId);
      await invalidate(`trip:${data.trip.id}`);
    } catch {
      kitComponents = updateComponent(kitComponents, itemId, componentId, previousChecked);
      showToast(strings.packing_list.save_failed, 'danger');
    }
  }

  function updateComponent(
    current: KitComponentRowState[],
    itemId: string,
    componentId: string,
    next: boolean
  ): KitComponentRowState[] {
    const idx = current.findIndex(
      (c) => c.kit_item_id === itemId && c.component_id === componentId
    );
    if (idx >= 0) {
      const copy = current.slice();
      copy[idx] = { ...copy[idx]!, is_checked: next };
      return copy;
    }
    return [
      ...current,
      { trip_id: data.trip.id, kit_item_id: itemId, component_id: componentId, is_checked: next }
    ];
  }
</script>

<header class="trip-head">
  <div class="title-row">
    <h2 class="trip-name">
      {data.trip.name ?? formatDateRange(data.trip.start_date, data.trip.end_date)}
    </h2>
    <a class="settings-link" href={`/trips/${data.trip.id}/settings`} aria-label={strings.a11y.settings}>
      <Settings size={20} />
    </a>
  </div>
  <p class="dates ltr-number">{formatDateRange(data.trip.start_date, data.trip.end_date)}</p>

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

  <div class="view-controls">
    <BagFilterToggle mode={viewMode} onChange={setViewMode} />
    <CheckedToBottomToggle checked={checkedToBottom} onChange={setCheckedToBottom} />
  </div>
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
    {#each grouped as [rawKey, rows] (rawKey)}
      <CategoryGroup title={groupLabel(rawKey)} count={rows.length}>
        {#each rows as item (item.row_id)}
          {@const expanded = expandedKits.has(item.row_id)}
          {@const partial = kitPartial(item)}
          <PackingListRow
            {item}
            {partial}
            expandable={item.is_kit && !!item.kit_contents}
            {expanded}
            onToggleCheck={() => patchItem(item, { is_checked: !item.is_checked })}
            onCountChange={(next) => patchItem(item, { count: next })}
            onToggleExpand={() => toggleKitExpand(item.row_id)}
          />
          {#if item.is_kit && item.kit_contents && expanded}
            <ul class="kit-components" aria-label={item.display_name}>
              {#each item.kit_contents as comp (comp.id)}
                <li>
                  <KitComponentRow
                    componentId={comp.id}
                    displayName={comp.display_name}
                    isChecked={isComponentChecked(item.item_id ?? '', comp.id)}
                    onToggle={() => toggleComponent(item.item_id ?? '', comp.id)}
                  />
                </li>
              {/each}
            </ul>
          {/if}
        {/each}
      </CategoryGroup>
    {/each}
  </div>
{/if}

<Fab onclick={() => (addSheetOpen = true)} ariaLabel={strings.manual_add.title}>
  <Plus size={28} />
</Fab>

<ManualAddSheet
  open={addSheetOpen}
  tripId={data.trip.id}
  {existingItemIds}
  onAdded={async () => {
    addSheetOpen = false;
    showToast(strings.manual_add.added_toast, 'success');
    await invalidate(`trip:${data.trip.id}`);
  }}
  onClose={() => (addSheetOpen = false)}
  onError={(msg) => showToast(msg, 'danger')}
/>

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

  .kit-components {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    padding-block-start: var(--space-1);
  }

  .view-controls {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    flex-wrap: wrap;
    padding-block-start: var(--space-2);
  }
</style>
