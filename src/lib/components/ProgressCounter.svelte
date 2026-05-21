<script lang="ts">
  import strings from '$lib/strings.js';

  interface Props {
    checkedRequired: number;
    totalRequired: number;
    uncheckedOptional: number;
  }

  let { checkedRequired, totalRequired, uncheckedOptional }: Props = $props();
</script>

<div class="counter" aria-label={strings.packing_list.progress_label}>
  <span class="primary ltr-number">{checkedRequired}/{totalRequired}</span>
  {#if uncheckedOptional > 0}
    <span class="optional">
      {strings.packing_list.optional_suffix.replace('{count}', String(uncheckedOptional))}
    </span>
  {/if}
</div>

<style>
  .counter {
    display: inline-flex;
    align-items: baseline;
    gap: var(--space-2);
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
</style>
