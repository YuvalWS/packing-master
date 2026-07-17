<script lang="ts">
  import type { PageData } from './$types.js';
  import { Plus, Backpack } from '@lucide/svelte';
  import TripCard from '$lib/components/TripCard.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import Fab from '$lib/components/Fab.svelte';
  import strings from '$lib/strings.js';

  interface Props {
    data: PageData;
  }

  let { data }: Props = $props();

  const parametersById = $derived(new Map(data.parameters.map((p) => [p.id, p])));

  const upcoming = $derived(
    data.trips
      .filter((t) => t.end_date >= data.todayISO)
      .sort((a, b) => a.start_date.localeCompare(b.start_date) || a.id - b.id)
  );
  const past = $derived(data.trips.filter((t) => t.end_date < data.todayISO));
</script>

{#if data.trips.length === 0}
  <EmptyState
    title={strings.trips_list.empty_title}
    message={strings.trips_list.empty_message}
  >
    {#snippet icon()}
      <Backpack size={48} strokeWidth={1.5} />
    {/snippet}
    {#snippet action()}
      <a class="cta" href="/trips/new">
        <Plus size={20} />
        <span>{strings.trips_list.create_cta}</span>
      </a>
    {/snippet}
  </EmptyState>
{:else}
  {#if upcoming.length > 0}
    <section class="section">
      <h2 class="section-title">{strings.trips_list.upcoming}</h2>
      <ul class="list">
        {#each upcoming as trip (trip.id)}
          <li><TripCard {trip} {parametersById} /></li>
        {/each}
      </ul>
    </section>
  {/if}

  {#if past.length > 0}
    <section class="section">
      {#if upcoming.length > 0}
        <hr class="divider" />
      {/if}
      <h2 class="section-title">{strings.trips_list.past}</h2>
      <ul class="list">
        {#each past as trip (trip.id)}
          <li><TripCard {trip} {parametersById} past /></li>
        {/each}
      </ul>
    </section>
  {/if}
{/if}

<Fab href="/trips/new" ariaLabel={strings.a11y.create_trip}>
  <Plus size={28} />
</Fab>

<style>
  .list {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .section {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding-block-start: var(--space-4);
  }

  .section-title {
    font-size: var(--fs-meta);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--color-text-muted);
  }

  .divider {
    border: 0;
    border-block-start: 1px solid var(--color-border);
    margin-block-end: var(--space-2);
  }

  .cta {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-5);
    border-radius: var(--radius-pill);
    background: var(--color-primary);
    color: white;
    font-weight: 500;
  }

  .cta:hover {
    text-decoration: none;
    background: #1d4ed8;
  }
</style>
