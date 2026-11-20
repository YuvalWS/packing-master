<script lang="ts">
  import type { Snippet } from 'svelte';
  import { CheckCheck } from '@lucide/svelte';
  import strings from '$lib/strings.js';

  interface Props {
    title: string;
    count?: number;
    /** Checked rows among `count`; shown as done/total. */
    done?: number;
    /** Checks every row of the group, or unchecks them when all are checked (DESIGN.md 15.1). */
    onCheckAll?: () => void;
    children: Snippet;
  }

  let { title, count, done, onCheckAll, children }: Props = $props();

  const allDone = $derived(count !== undefined && done !== undefined && count > 0 && done >= count);
</script>

<section class="group">
  <header class="head">
    <h3>{title}</h3>
    <div class="meta">
      {#if count !== undefined}
        {#if done !== undefined}
          <span
            class="count ltr-number"
            class:complete={allDone}
            aria-label={strings.packing_list.group_progress
              .replace('{done}', String(done))
              .replace('{total}', String(count))}>{done}/{count}</span
          >
        {:else}
          <span class="count ltr-number">{count}</span>
        {/if}
      {/if}
      {#if onCheckAll}
        <button
          type="button"
          class="check-all"
          class:complete={allDone}
          aria-pressed={allDone}
          aria-label={(allDone ? strings.packing_list.uncheck_group : strings.packing_list.check_group).replace(
            '{name}',
            title
          )}
          onclick={onCheckAll}
        >
          <CheckCheck size={18} />
        </button>
      {/if}
    </div>
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

  .meta {
    display: flex;
    align-items: center;
    gap: var(--space-2);
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
    font-variant-numeric: tabular-nums;
  }

  .count.complete {
    color: var(--color-success);
    font-weight: 700;
  }

  .check-all {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: var(--radius-md);
    color: var(--color-text-muted);
    cursor: pointer;
  }

  .check-all:hover {
    background: var(--color-primary-soft);
    color: var(--color-primary);
  }

  .check-all.complete {
    color: var(--color-primary);
  }

  .rows {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
</style>
