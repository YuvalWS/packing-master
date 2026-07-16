<script lang="ts">
  import type { PageData } from './$types.js';
  import { invalidate, goto } from '$app/navigation';
  import { Settings, Search, X, MoreHorizontal, Trash2 } from '@lucide/svelte';
  import PackingListRow from '$lib/components/PackingListRow.svelte';
  import KitComponentRow from '$lib/components/KitComponentRow.svelte';
  import CategoryGroup from '$lib/components/CategoryGroup.svelte';
  import ProgressCounter from '$lib/components/ProgressCounter.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import Toast from '$lib/components/Toast.svelte';
  import BagFilterToggle from '$lib/components/BagFilterToggle.svelte';
  import CheckedToBottomToggle from '$lib/components/CheckedToBottomToggle.svelte';
  import ManualAddSheet from '$lib/components/ManualAddSheet.svelte';
  import RowActionsSheet from '$lib/components/RowActionsSheet.svelte';
  import ParamChipList from '$lib/components/ParamChipList.svelte';
  import BottomSheet from '$lib/components/BottomSheet.svelte';
  import Fab from '$lib/components/Fab.svelte';
  import { Plus } from '@lucide/svelte';
  import type {
    EnrichedItem,
    Parameter,
    KitComponentRow as KitComponentRowState
  } from '$lib/client/api.js';
  import { makeApi } from '$lib/client/api.js';
  import { loadPrefs, savePrefs, type ViewMode } from '$lib/client/view-prefs.js';
  import { formatDateRange } from '$lib/util/format-date.js';
  import { bagLabel } from '$lib/util/bag-label.js';
  import { prefersReducedMotion } from '$lib/util/reduced-motion.js';
  import { slide } from 'svelte/transition';
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
  let menuItem = $state<EnrichedItem | null>(null);
  let tripMenuOpen = $state(false);
  let searchOpen = $state(false);
  let searchQuery = $state('');
  let filterMode = $state<'all' | 'required' | 'optional'>('all');

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

  const headerChips = $derived(
    data.trip.context.parameters
      .map((pid) => parametersById.get(pid))
      .filter((p): p is Parameter => !!p && !p.is_derived)
  );

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

  const visibleItems = $derived.by(() => {
    const q = searchQuery.trim().toLowerCase();
    return items.filter((it) => {
      if (q && !it.display_name.toLowerCase().includes(q)) return false;
      if (filterMode === 'required') return !it.is_optional && !it.is_checked;
      if (filterMode === 'optional') return it.is_optional && !it.is_checked;
      return true;
    });
  });

  function cycleFilter() {
    filterMode = filterMode === 'all' ? 'required' : filterMode === 'required' ? 'optional' : 'all';
  }

  function toggleSearch() {
    searchOpen = !searchOpen;
    if (!searchOpen) searchQuery = '';
  }

  interface DisplayRow {
    item: EnrichedItem;
    key: string;
    displayCount?: number;
    split?: boolean;
  }

  const grouped = $derived.by(() => {
    const groups = new Map<string, DisplayRow[]>();
    const push = (groupId: string, row: DisplayRow) => {
      const list = groups.get(groupId) ?? [];
      list.push(row);
      groups.set(groupId, list);
    };
    for (const it of visibleItems) {
      const distribution = it.bag_distribution as Record<string, number> | null;
      if (viewMode === 'bag' && distribution) {
        for (const [bag, n] of Object.entries(distribution)) {
          if (n > 0) {
            push(bag, { item: it, key: `${it.row_id}:${bag}`, displayCount: n, split: true });
          }
        }
      } else {
        push(groupKey(it), { item: it, key: String(it.row_id) });
      }
    }
    for (const list of groups.values()) {
      list.sort((a, b) => {
        if (checkedToBottom && a.item.is_checked !== b.item.is_checked) {
          return a.item.is_checked ? 1 : -1;
        }
        return a.item.display_name.localeCompare(b.item.display_name);
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
      return bagLabel(rawKey);
    }
    if (rawKey === '__no_category') return strings.packing_list.category_uncategorized;
    return rawKey;
  }

  const knownBags = $derived.by(() => {
    const set = new Set<string>();
    for (const it of items) {
      if (it.default_bag) set.add(it.default_bag);
      for (const key of Object.keys(it.bag_distribution ?? {})) set.add(key);
    }
    return [...set];
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

  function itemKey(item: EnrichedItem): string | number {
    return item.item_id ?? item.row_id;
  }

  let tripDeleteArmed = $state(false);

  function openTripMenu() {
    tripDeleteArmed = false;
    tripMenuOpen = true;
  }

  async function deleteTrip() {
    try {
      const api = makeApi();
      await api.deleteTrip(data.trip.id);
      tripMenuOpen = false;
      showToast(strings.settings.deleted_toast, 'success');
      setTimeout(() => goto('/'), 300);
    } catch {
      showToast(strings.settings.save_failed, 'danger');
    }
  }

  async function saveNote(item: EnrichedItem, notes: string | null) {
    try {
      const api = makeApi();
      await api.patchTripItem(data.trip.id, itemKey(item), { notes });
      menuItem = null;
      showToast(strings.row_menu.saved_toast, 'success');
      await invalidate(`trip:${data.trip.id}`);
    } catch {
      showToast(strings.packing_list.save_failed, 'danger');
    }
  }

  async function saveSplit(item: EnrichedItem, distribution: Record<string, number> | null) {
    try {
      const api = makeApi();
      await api.patchTripItem(data.trip.id, itemKey(item), { bag_distribution: distribution });
      menuItem = null;
      showToast(strings.row_menu.saved_toast, 'success');
      await invalidate(`trip:${data.trip.id}`);
    } catch {
      showToast(strings.packing_list.save_failed, 'danger');
    }
  }

  async function deleteManualItem(item: EnrichedItem) {
    try {
      const api = makeApi();
      await api.deleteTripItem(data.trip.id, item.row_id);
      menuItem = null;
      showToast(strings.row_menu.deleted_toast, 'success');
      await invalidate(`trip:${data.trip.id}`);
    } catch {
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
    <div class="title-actions">
      <a
        class="settings-link"
        href={`/trips/${data.trip.id}/settings`}
        aria-label={strings.a11y.settings}
      >
        <Settings size={20} />
      </a>
      <button
        type="button"
        class="settings-link"
        aria-label={strings.trip_menu.open}
        onclick={openTripMenu}
      >
        <MoreHorizontal size={20} />
      </button>
    </div>
  </div>
  <p class="dates">
    <span class="ltr-number">{formatDateRange(data.trip.start_date, data.trip.end_date)}</span>
    · <span class="ltr-number">{data.derived.days}</span>
    {data.derived.days === 1 ? strings.common.day_one : strings.common.day_many}
    {#if data.derived.hasShabbat}
      · {data.derived.shabbatCount === 1
        ? strings.trip_header.shabbat_one
        : strings.trip_header.shabbat_many.replace('{count}', String(data.derived.shabbatCount))}
    {/if}
  </p>

  <div class="param-chips">
    <ParamChipList parameters={headerChips} active />
  </div>

  <div class="counter-row">
    <ProgressCounter
      checkedRequired={stats.checkedRequired}
      totalRequired={stats.totalRequired}
      uncheckedOptional={stats.uncheckedOptional}
      {filterMode}
      onCycle={cycleFilter}
    />
    <button
      type="button"
      class="search-btn"
      class:active={searchOpen}
      aria-label={strings.packing_list.search_open}
      aria-pressed={searchOpen}
      onclick={toggleSearch}
    >
      {#if searchOpen}<X size={18} />{:else}<Search size={18} />{/if}
    </button>
  </div>

  {#if searchOpen}
    <!-- svelte-ignore a11y_autofocus -->
    <input
      type="search"
      class="search-input"
      placeholder={strings.packing_list.search_placeholder}
      autofocus
      bind:value={searchQuery}
    />
  {/if}

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
        {#each rows as row (row.key)}
          {@const item = row.item}
          {@const expanded = expandedKits.has(item.row_id)}
          {@const partial = kitPartial(item)}
          <PackingListRow
            {item}
            {partial}
            expandable={item.is_kit && !!item.kit_contents}
            {expanded}
            displayCount={row.displayCount}
            stepperDisabled={row.split}
            onToggleCheck={() => patchItem(item, { is_checked: !item.is_checked })}
            onCountChange={(next) => patchItem(item, { count: next })}
            onToggleExpand={() => toggleKitExpand(item.row_id)}
            onOpenMenu={() => (menuItem = item)}
          />
          {#if item.is_kit && item.kit_contents && expanded}
            <ul
              class="kit-components"
              aria-label={item.display_name}
              transition:slide={{ duration: prefersReducedMotion() ? 0 : 180 }}
            >
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

<RowActionsSheet
  item={menuItem}
  {knownBags}
  onSaveNote={saveNote}
  onSaveSplit={saveSplit}
  onDelete={deleteManualItem}
  onClose={() => (menuItem = null)}
/>

<BottomSheet
  open={tripMenuOpen}
  title={strings.trip_menu.title}
  onClose={() => (tripMenuOpen = false)}
>
  {#if !tripDeleteArmed}
    <ul class="trip-menu">
      <li>
        <a class="trip-menu-item" href={`/trips/${data.trip.id}/settings`}>
          <Settings size={20} />
          <span>{strings.settings.title}</span>
        </a>
      </li>
      <li>
        <button
          type="button"
          class="trip-menu-item danger"
          onclick={() => (tripDeleteArmed = true)}
        >
          <Trash2 size={20} />
          <span>{strings.settings.delete_trip}</span>
        </button>
      </li>
    </ul>
  {:else}
    <div class="trip-menu-confirm">
      <p>{strings.settings.delete_confirm}</p>
      <div class="confirm-row">
        <button type="button" class="ghost" onclick={() => (tripDeleteArmed = false)}>
          {strings.common.cancel}
        </button>
        <button type="button" class="danger-btn" onclick={deleteTrip}>
          {strings.settings.delete_trip}
        </button>
      </div>
    </div>
  {/if}
</BottomSheet>

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
    padding-block: var(--space-2);
  }

  .title-actions {
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }

  .counter-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
  }

  .search-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: var(--radius-md);
    color: var(--color-text-muted);
    cursor: pointer;
  }

  .search-btn:hover,
  .search-btn.active {
    background: var(--color-primary-soft);
    color: var(--color-primary);
  }

  .search-input {
    width: 100%;
    padding: var(--space-3);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface);
  }

  .trip-menu {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .trip-menu-item {
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

  .trip-menu-item:hover {
    background: var(--color-primary-soft);
    text-decoration: none;
  }

  .trip-menu-item.danger {
    color: var(--color-danger);
  }

  .trip-menu-item.danger:hover {
    background: var(--color-danger-soft);
  }

  .trip-menu-confirm {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .confirm-row {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
  }

  .ghost {
    padding: var(--space-2) var(--space-4);
    border-radius: var(--radius-pill);
    color: var(--color-text-muted);
    cursor: pointer;
  }

  .ghost:hover {
    background: var(--color-bg);
    color: var(--color-text);
  }

  .danger-btn {
    padding: var(--space-2) var(--space-4);
    border-radius: var(--radius-pill);
    background: var(--color-danger);
    color: white;
    cursor: pointer;
  }

  .danger-btn:hover {
    background: #b91c1c;
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
