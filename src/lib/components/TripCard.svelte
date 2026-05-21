<script lang="ts">
  import type { TripRowWithItemCount, Parameter } from '$lib/client/api.js';
  import ParamChip from './ParamChip.svelte';
  import strings from '$lib/strings.js';

  interface Props {
    trip: TripRowWithItemCount;
    parametersById: Map<string, Parameter>;
    maxChipsShown?: number;
  }

  let { trip, parametersById, maxChipsShown = 3 }: Props = $props();

  let expanded = $state(false);

  const days = $derived(daysBetween(trip.start_date, trip.end_date));

  const displayName = $derived(
    trip.name && trip.name.trim().length > 0
      ? trip.name
      : strings.trips_list.no_name_fallback.replace('{days}', String(days))
  );

  const dateRange = $derived(`${formatDate(trip.start_date)} – ${formatDate(trip.end_date)}`);

  const itemCountLabel = $derived(
    trip.item_count === 1
      ? strings.trips_list.items_count_one
      : strings.trips_list.items_count_many.replace('{count}', String(trip.item_count))
  );

  const paramChips = $derived(
    trip.context.parameters
      .map((id) => parametersById.get(id))
      .filter((p): p is Parameter => !!p && !p.is_derived)
  );

  const visibleChips = $derived(expanded ? paramChips : paramChips.slice(0, maxChipsShown));
  const overflowCount = $derived(paramChips.length - maxChipsShown);

  function daysBetween(startISO: string, endISO: string): number {
    const start = new Date(startISO + 'T00:00:00Z');
    const end = new Date(endISO + 'T00:00:00Z');
    const ms = end.getTime() - start.getTime();
    return Math.max(1, Math.round(ms / 86_400_000) + 1);
  }

  function formatDate(iso: string): string {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }
</script>

<a class="card" href="/trips/{trip.id}" aria-label={displayName}>
  <header class="head">
    <h2 class="title">{displayName}</h2>
    <span class="dates ltr-number">{dateRange}</span>
  </header>

  {#if paramChips.length > 0}
    <ul class="chips">
      {#each visibleChips as p (p.id)}
        <li><ParamChip label={p.display_name} /></li>
      {/each}
      {#if !expanded && overflowCount > 0}
        <li>
          <button
            type="button"
            class="more-btn"
            onclick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              expanded = true;
            }}
          >
            {strings.trips_list.and_more.replace('{count}', String(overflowCount))}
          </button>
        </li>
      {/if}
    </ul>
  {/if}

  <footer class="foot">
    <span class="count">{itemCountLabel}</span>
  </footer>
</a>

<style>
  .card {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-4);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    color: var(--color-text);
    box-shadow: var(--shadow-sm);
    transition: box-shadow 0.12s ease, transform 0.12s ease;
  }

  .card:hover {
    text-decoration: none;
    box-shadow: var(--shadow-md);
    transform: translateY(-1px);
  }

  .head {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .title {
    font-size: var(--fs-row);
    font-weight: 700;
  }

  .dates {
    font-size: var(--fs-meta);
    color: var(--color-text-muted);
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1);
  }

  .more-btn {
    display: inline-flex;
    align-items: center;
    padding: 4px 10px;
    border-radius: var(--radius-pill);
    background: transparent;
    border: 1px dashed var(--color-border);
    color: var(--color-text-muted);
    font-size: var(--fs-meta);
    cursor: pointer;
  }

  .more-btn:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  .foot {
    display: flex;
    justify-content: flex-end;
  }

  .count {
    font-size: var(--fs-meta);
    color: var(--color-text-muted);
  }
</style>
