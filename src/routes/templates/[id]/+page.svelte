<script lang="ts">
  import type { PageData } from './$types.js';
  import { ChevronLeft } from '@lucide/svelte';
  import ParamChip from '$lib/components/ParamChip.svelte';
  import strings from '$lib/strings.js';

  interface Props {
    data: PageData;
  }

  let { data }: Props = $props();

  const parametersById = $derived(new Map(data.parameters.map((p) => [p.id, p])));
</script>

<a class="back" href="/templates">
  <ChevronLeft size={18} />
  <span>{strings.templates_catalog.back_to_list}</span>
</a>

<header class="head">
  <h2>{data.template.display_name}</h2>
  <span class="id ltr-number">{data.template.id}</span>
</header>

<dl class="fields">
  <div class="field wide">
    <dt>{strings.templates_catalog.field_parameters}</dt>
    <dd>
      {#if data.template.default_parameters.length === 0}
        <p class="empty">{strings.templates_catalog.no_default_parameters}</p>
      {:else}
        <ul class="chips">
          {#each data.template.default_parameters as pid (pid)}
            {@const p = parametersById.get(pid)}
            {#if p}
              <li><ParamChip label={p.display_name} /></li>
            {:else}
              <li><ParamChip label={pid} muted /></li>
            {/if}
          {/each}
        </ul>
      {/if}
    </dd>
  </div>
  {#if data.template.default_extras && Object.keys(data.template.default_extras).length > 0}
    <div class="field wide">
      <dt>{strings.templates_catalog.field_extras}</dt>
      <dd>
        <pre class="extras ltr-number">{JSON.stringify(data.template.default_extras, null, 2)}</pre>
      </dd>
    </div>
  {/if}
</dl>

<style>
  .back {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    color: var(--color-text-muted);
    font-size: var(--fs-meta);
    padding-block-end: var(--space-3);
  }

  :global(html[dir='rtl']) .back :global(svg) {
    transform: scaleX(-1);
  }

  .head {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    padding-block: var(--space-2);
    border-block-end: 1px solid var(--color-border);
    margin-block-end: var(--space-4);
  }

  h2 {
    font-size: var(--fs-title);
    font-weight: 700;
  }

  .id {
    color: var(--color-text-muted);
    font-size: var(--fs-meta);
  }

  .fields {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-3);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
  }

  dt {
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

  .extras {
    margin: 0;
    padding: var(--space-3);
    background: var(--color-bg);
    border-radius: var(--radius-sm);
    overflow-x: auto;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: var(--fs-meta);
  }
</style>
