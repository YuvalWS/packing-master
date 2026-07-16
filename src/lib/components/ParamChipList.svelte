<script lang="ts">
  import ParamChip from './ParamChip.svelte';
  import type { Parameter } from '$lib/client/api.js';
  import strings from '$lib/strings.js';

  interface Props {
    parameters: Parameter[];
    active?: boolean;
    maxShown?: number;
  }

  let { parameters, active = false, maxShown = 3 }: Props = $props();

  let expanded = $state(false);

  const visible = $derived(expanded ? parameters : parameters.slice(0, maxShown));
  const overflowCount = $derived(parameters.length - maxShown);

  function toggle(e: MouseEvent) {
    // Chips may live inside a link card; the toggle must not navigate.
    e.preventDefault();
    e.stopPropagation();
    expanded = !expanded;
  }
</script>

{#if parameters.length > 0}
  <ul class="chips">
    {#each visible as p (p.id)}
      <li><ParamChip label={p.display_name} {active} /></li>
    {/each}
    {#if overflowCount > 0}
      <li>
        <button type="button" class="more-btn" aria-expanded={expanded} onclick={toggle}>
          {expanded
            ? strings.trips_list.show_less
            : strings.trips_list.and_more.replace('{count}', String(overflowCount))}
        </button>
      </li>
    {/if}
  </ul>
{/if}

<style>
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
</style>
