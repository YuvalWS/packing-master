<script lang="ts">
  import type { PageData } from './$types.js';
  import ParamChip from '$lib/components/ParamChip.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import strings from '$lib/strings.js';

  interface Props {
    data: PageData;
  }

  let { data }: Props = $props();

  const parametersById = $derived(new Map(data.parameters.map((p) => [p.id, p])));
</script>

<section class="screen">
  {#if data.templates.length === 0}
    <EmptyState title={strings.templates_catalog.not_found} />
  {:else}
    <ul class="list">
      {#each data.templates as t (t.id)}
        <li>
          <a class="card" href={`/templates/${t.id}`}>
            <header>
              <h2>{t.display_name}</h2>
              <span class="id ltr-number">{t.id}</span>
            </header>
            {#if t.default_parameters.length > 0}
              <ul class="chips">
                {#each t.default_parameters as pid (pid)}
                  {@const p = parametersById.get(pid)}
                  {#if p}
                    <li><ParamChip label={p.display_name} /></li>
                  {/if}
                {/each}
              </ul>
            {:else}
              <p class="empty">{strings.templates_catalog.no_default_parameters}</p>
            {/if}
          </a>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .screen {
    padding-block-start: var(--space-3);
  }

  .list {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .card {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-4);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    color: var(--color-text);
  }

  .card:hover {
    text-decoration: none;
    border-color: var(--color-primary);
  }

  header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: var(--space-2);
  }

  h2 {
    font-size: var(--fs-row);
    font-weight: 700;
  }

  .id {
    font-size: var(--fs-meta);
    color: var(--color-text-muted);
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1);
  }

  .empty {
    color: var(--color-text-muted);
    font-size: var(--fs-meta);
  }
</style>
