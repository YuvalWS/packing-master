<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    title: string;
    count?: number;
    children: Snippet;
  }

  let { title, count, children }: Props = $props();
</script>

<section class="group">
  <header class="head">
    <h3>{title}</h3>
    {#if count !== undefined}
      <span class="count ltr-number">{count}</span>
    {/if}
  </header>
  <div class="rows">
    {@render children()}
  </div>
</section>

<style>
  .group {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-inline: var(--space-2);
  }

  h3 {
    font-size: var(--fs-meta);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--color-text-muted);
    font-weight: 700;
  }

  .count {
    font-size: var(--fs-meta);
    color: var(--color-text-muted);
  }

  .rows {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
</style>
