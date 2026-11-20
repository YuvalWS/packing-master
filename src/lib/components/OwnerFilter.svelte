<script lang="ts" module>
  export interface OwnerChip {
    /** Person id, or '' for shared rows. */
    id: string;
    name: string;
    done: number;
    total: number;
    hidden: boolean;
  }
</script>

<script lang="ts">
  import strings from '$lib/strings.js';

  interface Props {
    owners: OwnerChip[];
    onToggle: (id: string) => void;
  }

  let { owners, onToggle }: Props = $props();
</script>

<div class="owners" role="group" aria-label={strings.owners.label}>
  {#each owners as o (o.id)}
    <button
      type="button"
      class="chip"
      class:hidden={o.hidden}
      class:complete={o.total > 0 && o.done >= o.total}
      aria-pressed={!o.hidden}
      aria-label={(o.hidden ? strings.owners.show : strings.owners.hide).replace('{name}', o.name)}
      data-owner={o.id}
      onclick={() => onToggle(o.id)}
    >
      <span class="name">{o.name}</span>
      <span class="ltr-number progress">{o.done}/{o.total}</span>
    </button>
  {/each}
</div>

<style>
  .owners {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .chip {
    display: inline-flex;
    align-items: baseline;
    gap: var(--space-1);
    padding: 4px 12px;
    border-radius: var(--radius-pill);
    border: 1px solid var(--color-primary);
    background: var(--color-primary-soft);
    color: var(--color-text);
    font-size: var(--fs-meta);
    cursor: pointer;
  }

  .progress {
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .chip.complete .progress {
    color: var(--color-primary);
  }

  .chip.hidden {
    border-color: var(--color-border);
    background: var(--color-surface);
    color: var(--color-text-muted);
  }

  .chip.hidden .name {
    text-decoration: line-through;
  }
</style>
