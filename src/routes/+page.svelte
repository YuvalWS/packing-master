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
  <ul class="list">
    {#each data.trips as trip (trip.id)}
      <li><TripCard {trip} {parametersById} /></li>
    {/each}
  </ul>
{/if}

<Fab href="/trips/new" ariaLabel={strings.a11y.create_trip}>
  <Plus size={28} />
</Fab>

<style>
  .list {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding-block-start: var(--space-4);
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
