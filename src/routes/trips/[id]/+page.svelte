<script lang="ts">
  import type { PageData } from './$types.js';
  import { invalidate, goto, beforeNavigate } from '$app/navigation';
  import { onDestroy } from 'svelte';
  import { Settings, Search, X, MoreHorizontal, Trash2 } from '@lucide/svelte';
  import PackingListRow from '$lib/components/PackingListRow.svelte';
  import KitComponentRow from '$lib/components/KitComponentRow.svelte';
  import CategoryGroup from '$lib/components/CategoryGroup.svelte';
  import OwnerFilter, { type OwnerChip } from '$lib/components/OwnerFilter.svelte';
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
  import { tripDisplayName } from '$lib/util/trip-name.js';
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
  let toastAction = $state<{ label: string; onClick: () => void } | null>(null);

  // Deletes wait 5 s for Undo before reaching the server (DESIGN.md 14.2).
  const UNDO_MS = 5000;
  let hiddenRowIds = $state<Set<number>>(new Set());
  const pendingDeletes = new Map<number, ReturnType<typeof setTimeout>>();
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
  let hiddenOwners = $state<Set<string>>(new Set());

  $effect(() => {
    const prefs = loadPrefs(data.trip.id);
    viewMode = prefs.mode;
    checkedToBottom = prefs.checkedToBottom;
    hiddenOwners = new Set(prefs.hiddenOwners);
  });

  function persistPrefs() {
    savePrefs(data.trip.id, { mode: viewMode, checkedToBottom, hiddenOwners: [...hiddenOwners] });
  }

  function setViewMode(next: ViewMode) {
    viewMode = next;
    persistPrefs();
  }

  function setCheckedToBottom(next: boolean) {
    checkedToBottom = next;
    persistPrefs();
  }

  function toggleOwner(id: string) {
    const next = new Set(hiddenOwners);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    hiddenOwners = next;
    persistPrefs();
  }

  // One chip per owner of rows on this trip: travelers in trip order, shared last (DESIGN.md 15.2).
  const owners = $derived.by((): OwnerChip[] => {
    const byId = new Map<string, OwnerChip>();
    for (const it of items) {
      const id = it.person_id ?? '';
      let chip = byId.get(id);
      if (!chip) {
        chip = {
          id,
          name: id === '' ? strings.owners.shared : (it.person_name ?? id),
          done: 0,
          total: 0,
          hidden: hiddenOwners.has(id)
        };
        byId.set(id, chip);
      }
      if (!it.is_optional) {
        chip.total += 1;
        if (it.is_checked) chip.done += 1;
      }
    }
    const order = data.trip.travelers ?? [];
    const rank = (id: string) => (id === '' ? Number.MAX_SAFE_INTEGER : order.indexOf(id) === -1 ? order.length : order.indexOf(id));
    return [...byId.values()].sort((a, b) => rank(a.id) - rank(b.id) || a.name.localeCompare(b.name));
  });

  $effect(() => {
    items = data.items.filter((it) => !hiddenRowIds.has(it.row_id));
    kitComponents = data.kitComponents;
  });

  // A kit row is addressed as item_id, or item_id:person_id for a per-person kit.
  const kitKey = (item: EnrichedItem) =>
    item.person_id ? `${item.item_id ?? ''}:${item.person_id}` : (item.item_id ?? '');
  const compKey = (c: KitComponentRowState) =>
    c.person_id ? `${c.kit_item_id}:${c.person_id}` : c.kit_item_id;

  function kitState(key: string) {
    return kitComponents.filter((c) => compKey(c) === key);
  }

  function kitPartial(item: EnrichedItem): boolean {
    if (!item.is_kit || !item.kit_contents) return false;
    const states = kitState(kitKey(item));
    const checkedCount = states.filter((s) => s.is_checked).length;
    return checkedCount > 0 && checkedCount < item.kit_contents.length;
  }

  function isComponentChecked(key: string, componentId: string): boolean {
    return kitComponents.some(
      (c) => compKey(c) === key && c.component_id === componentId && c.is_checked
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
      if (hiddenOwners.has(it.person_id ?? '')) return false;
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
    toastAction = null;
    toastTone = tone;
    toastMsg = msg;
  }

  function groupDone(rows: DisplayRow[]): { done: number; total: number } {
    const seen = new Map<number, boolean>();
    for (const r of rows) seen.set(r.item.row_id, r.item.is_checked);
    let done = 0;
    for (const checked of seen.values()) if (checked) done += 1;
    return { done, total: seen.size };
  }

  function setCheckedLocally(rowIds: Set<number>, isChecked: boolean) {
    items = items.map((it) => (rowIds.has(it.row_id) ? { ...it, is_checked: isChecked } : it));
  }

  async function sendChecked(rowIds: number[], isChecked: boolean): Promise<boolean> {
    try {
      await makeApi().checkTripItems(data.trip.id, rowIds, isChecked);
      await invalidate(`trip:${data.trip.id}`);
      return true;
    } catch {
      setCheckedLocally(new Set(rowIds), !isChecked);
      showToast(strings.packing_list.save_failed, 'danger');
      return false;
    }
  }

  // Checks the visible rows of a group, or unchecks them when all are checked (DESIGN.md 15.1).
  async function checkGroup(rows: DisplayRow[]) {
    const unique = new Map<number, EnrichedItem>();
    for (const r of rows) unique.set(r.item.row_id, r.item);
    const all = [...unique.values()];
    const target = all.some((it) => !it.is_checked);
    const changed = all.filter((it) => it.is_checked !== target).map((it) => it.row_id);
    if (changed.length === 0) return;
    setCheckedLocally(new Set(changed), target);
    if (!(await sendChecked(changed, target))) return;
    toastTone = 'info';
    toastMsg = (target ? strings.packing_list.checked_many : strings.packing_list.unchecked_many).replace(
      '{count}',
      String(changed.length)
    );
    toastAction = {
      label: strings.row_menu.undo,
      onClick: () => {
        toastMsg = null;
        toastAction = null;
        setCheckedLocally(new Set(changed), !target);
        void sendChecked(changed, !target);
      }
    };
  }

  function setHidden(rowId: number, hidden: boolean) {
    const next = new Set(hiddenRowIds);
    if (hidden) next.add(rowId);
    else next.delete(rowId);
    hiddenRowIds = next;
  }

  function deleteWithUndo(item: EnrichedItem) {
    const rowId = item.row_id;
    menuItem = null;
    setHidden(rowId, true);
    pendingDeletes.set(rowId, setTimeout(() => void commitDelete(rowId), UNDO_MS));
    const name = item.person_name ? `${item.display_name} (${item.person_name})` : item.display_name;
    toastTone = 'info';
    toastMsg = strings.row_menu.deleted_undo.replace('{name}', name);
    toastAction = { label: strings.row_menu.undo, onClick: () => undoDelete(rowId) };
  }

  function undoDelete(rowId: number) {
    const timer = pendingDeletes.get(rowId);
    if (timer) clearTimeout(timer);
    pendingDeletes.delete(rowId);
    setHidden(rowId, false);
    toastMsg = null;
    toastAction = null;
  }

  async function commitDelete(rowId: number) {
    pendingDeletes.delete(rowId);
    try {
      await makeApi().deleteTripItem(data.trip.id, rowId);
      await invalidate(`trip:${data.trip.id}`);
      setHidden(rowId, false);
    } catch {
      setHidden(rowId, false);
      showToast(strings.packing_list.save_failed, 'danger');
    }
  }

  // Leaving the page sends the waiting deletes right away; keepalive survives a reload.
  function flushDeletes() {
    for (const [rowId, timer] of pendingDeletes) {
      clearTimeout(timer);
      void fetch(`/api/trips/${data.trip.id}/items/${rowId}`, { method: 'DELETE', keepalive: true });
    }
    pendingDeletes.clear();
  }

  beforeNavigate(flushDeletes);
  onDestroy(flushDeletes);
  $effect(() => {
    window.addEventListener('pagehide', flushDeletes);
    return () => window.removeEventListener('pagehide', flushDeletes);
  });

  async function patchItem(item: EnrichedItem, patch: { is_checked?: boolean; count?: number }) {
    const previous = { ...item };
    Object.assign(item, patch);
    items = items.map((it) => (it.row_id === item.row_id ? { ...item } : it));
    try {
      const api = makeApi();
      const key = item.row_id;
      await api.patchTripItem(data.trip.id, key, patch);
      await invalidate(`trip:${data.trip.id}`);
    } catch {
      Object.assign(item, previous);
      items = items.map((it) => (it.row_id === item.row_id ? { ...previous } : it));
      showToast(strings.packing_list.save_failed, 'danger');
    }
  }

  function itemKey(item: EnrichedItem): string | number {
    return item.row_id;
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

  async function deleteFromMenu(item: EnrichedItem) {
    deleteWithUndo(item);
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
      (c) => compKey(c) === itemId && c.component_id === componentId
    );
    if (idx >= 0) {
      const copy = current.slice();
      copy[idx] = { ...copy[idx]!, is_checked: next };
      return copy;
    }
    return [
      ...current,
      {
        trip_id: data.trip.id,
        kit_item_id: itemId.split(':')[0]!,
        person_id: itemId.split(':')[1] ?? '',
        component_id: componentId,
        is_checked: next
      }
    ];
  }
</script>

<header class="trip-head">
  <div class="title-row">
    <h2 class="trip-name">
      {tripDisplayName(data.trip, parametersById)}
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
      ·
      {#if data.derived.yomTovCount > 0}
        {data.derived.shabbatCount === 1
          ? strings.trip_header.holy_one
          : strings.trip_header.holy_many.replace('{count}', String(data.derived.shabbatCount))}
      {:else}
        {data.derived.shabbatCount === 1
          ? strings.trip_header.shabbat_one
          : strings.trip_header.shabbat_many.replace('{count}', String(data.derived.shabbatCount))}
      {/if}
    {/if}
  </p>
  <p class="hebrew-dates">
    {data.derived.hebrewStart === data.derived.hebrewEnd
      ? data.derived.hebrewStart
      : `${data.derived.hebrewStart} – ${data.derived.hebrewEnd}`}
    {#each data.derived.holidays as h (h)}
      <span class="holiday">{strings.holidays[h]}</span>
    {/each}
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

  {#if owners.length > 1}
    <OwnerFilter {owners} onToggle={toggleOwner} />
  {/if}

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
      {@const progress = groupDone(rows)}
      <CategoryGroup
        title={groupLabel(rawKey)}
        count={progress.total}
        done={progress.done}
        onCheckAll={() => checkGroup(rows)}
      >
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
            onDelete={row.split ? undefined : () => deleteWithUndo(item)}
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
                    isChecked={isComponentChecked(kitKey(item), comp.id)}
                    onToggle={() => toggleComponent(kitKey(item), comp.id)}
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
  onDelete={deleteFromMenu}
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

<Toast
  message={toastMsg}
  tone={toastTone}
  action={toastAction}
  durationMs={toastAction ? UNDO_MS : 3000}
  onDismiss={() => {
    toastMsg = null;
    toastAction = null;
  }}
/>

<style>
  .hebrew-dates {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
    color: var(--color-text-muted);
    font-size: var(--fs-meta);
  }

  .holiday {
    padding: 2px 8px;
    border-radius: var(--radius-pill);
    background: var(--color-warning-soft);
    color: var(--color-text);
  }

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
