<script lang="ts">
  import { Check } from '@lucide/svelte';
  import strings from '$lib/strings.js';

  interface Props {
    componentId: string;
    displayName: string;
    isChecked: boolean;
    onToggle: () => void;
  }

  let { componentId, displayName, isChecked, onToggle }: Props = $props();

  const label = $derived(strings.a11y_row.toggle_check.replace('{name}', displayName));
</script>

<div class="kit-row" class:checked={isChecked} data-component-id={componentId}>
  <button
    type="button"
    class="checkbox"
    role="checkbox"
    aria-checked={isChecked}
    aria-label={label}
    onclick={onToggle}
  >
    {#if isChecked}<Check size={14} />{/if}
  </button>
  <span class="name">{displayName}</span>
</div>

<style>
  .kit-row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-2) var(--space-4);
    padding-inline-start: calc(var(--space-4) + 24px);
    background: var(--color-bg);
    border-radius: var(--radius-sm);
  }

  .kit-row.checked .name {
    text-decoration: line-through;
    color: var(--color-text-muted);
  }

  .checkbox {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border-radius: var(--radius-sm);
    border: 2px solid var(--color-border);
    background: var(--color-surface);
    color: var(--color-primary);
    cursor: pointer;
    flex-shrink: 0;
  }

  .kit-row.checked .checkbox {
    background: var(--color-success);
    border-color: var(--color-success);
    color: white;
  }

  .name {
    font-size: var(--fs-body);
  }
</style>
