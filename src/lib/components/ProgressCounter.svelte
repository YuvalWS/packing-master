<script lang="ts">
  import strings from '$lib/strings.js';

  interface Props {
    checkedRequired: number;
    totalRequired: number;
    uncheckedOptional: number;
    filterMode?: 'all' | 'required' | 'optional';
    onCycle?: () => void;
  }

  let {
    checkedRequired,
    totalRequired,
    uncheckedOptional,
    filterMode = 'all',
    onCycle
  }: Props = $props();

  const modeLabel = $derived(
    filterMode === 'required'
      ? strings.packing_list.filter_required
      : filterMode === 'optional'
        ? strings.packing_list.filter_optional
        : strings.packing_list.filter_all
  );
</script>

{#if onCycle}
  <button
    type="button"
    class="counter clickable"
    aria-label={`${strings.packing_list.filter_hint}: ${modeLabel}`}
    onclick={onCycle}
  >
    <span class="primary ltr-number">{checkedRequired}/{totalRequired}</span>
    {#if uncheckedOptional > 0}
      <span class="optional">
        {strings.packing_list.optional_suffix.replace('{count}', String(uncheckedOptional))}
      </span>
    {/if}
    {#if filterMode !== 'all'}
      <span class="mode">{modeLabel}</span>
    {/if}
  </button>
{:else}
  <div class="counter" aria-label={strings.packing_list.progress_label}>
    <span class="primary ltr-number">{checkedRequired}/{totalRequired}</span>
    {#if uncheckedOptional > 0}
      <span class="optional">
        {strings.packing_list.optional_suffix.replace('{count}', String(uncheckedOptional))}
      </span>
    {/if}
  </div>
{/if}

<style>
  .counter {
    display: inline-flex;
    align-items: baseline;
    gap: var(--space-2);
  }

  .clickable {
    cursor: pointer;
    border-radius: var(--radius-md);
    padding: var(--space-1) var(--space-2);
    margin-inline: calc(-1 * var(--space-2));
  }

  .clickable:hover {
    background: var(--color-primary-soft);
  }

  .primary {
    font-size: var(--fs-row);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .optional {
    font-size: var(--fs-meta);
    color: var(--color-text-muted);
  }

  .mode {
    font-size: var(--fs-meta);
    color: var(--color-primary);
    font-weight: 600;
  }
</style>
