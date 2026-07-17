<script lang="ts">
  import { Check } from '@lucide/svelte';
  import type { TripRowWithItemCount, Parameter } from '$lib/client/api.js';
  import ParamChipList from './ParamChipList.svelte';
  import strings from '$lib/strings.js';
  import { formatDateRange } from '$lib/util/format-date.js';
  import { tripDisplayName, daysBetween } from '$lib/util/trip-name.js';

  interface Props {
    trip: TripRowWithItemCount;
    parametersById: Map<string, Parameter>;
    maxChipsShown?: number;
    past?: boolean;
  }

  let { trip, parametersById, maxChipsShown = 3, past = false }: Props = $props();

  const days = $derived(daysBetween(trip.start_date, trip.end_date));

  const displayName = $derived(tripDisplayName(trip, parametersById));

  const dateRange = $derived(formatDateRange(trip.start_date, trip.end_date));

  const completed = $derived(past && trip.item_count > 0 && trip.checked_count === trip.item_count);

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
</script>

<a class="card" class:past href="/trips/{trip.id}" aria-label={displayName}>
  <header class="head">
    <h2 class="title">{displayName}</h2>
    <span class="dates">
      <span class="ltr-number">{dateRange}</span>
      · <span class="ltr-number">{days}</span>
      {days === 1 ? strings.common.day_one : strings.common.day_many}
    </span>
  </header>

  <ParamChipList parameters={paramChips} maxShown={maxChipsShown} />

  <footer class="foot">
    {#if completed}
      <span class="completed">
        <Check size={14} aria-hidden="true" />
        {strings.trips_list.completed}
      </span>
    {:else}
      <span class="count">{itemCountLabel}</span>
    {/if}
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

  .foot {
    display: flex;
    justify-content: flex-end;
  }

  .count {
    font-size: var(--fs-meta);
    color: var(--color-text-muted);
  }

  .card.past {
    opacity: 0.75;
    background: var(--color-bg);
  }

  .completed {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    font-size: var(--fs-meta);
    color: var(--color-success);
    font-weight: 600;
  }
</style>
