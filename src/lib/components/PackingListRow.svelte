<script lang="ts">
  import { Check } from '@lucide/svelte';
  import Stepper from './Stepper.svelte';
  import strings from '$lib/strings.js';

  export interface EnrichedItem {
    row_id: number;
    item_id: string | null;
    display_name: string;
    category: string | null;
    default_bag: string | null;
    is_kit: boolean;
    is_optional: boolean;
    count: number;
    is_checked: boolean;
    is_manual: boolean;
    bag_distribution: Record<string, unknown> | null;
    notes: string | null;
    count_was_edited: boolean;
  }

  interface Props {
    item: EnrichedItem;
    onToggleCheck: () => void;
    onCountChange: (next: number) => void;
  }

  let { item, onToggleCheck, onCountChange }: Props = $props();

  const checkLabel = $derived(strings.a11y_row.toggle_check.replace('{name}', item.display_name));
</script>

<div class="row" class:checked={item.is_checked} class:optional={item.is_optional}>
  <button
    type="button"
    class="checkbox"
    class:dashed={item.is_optional}
    role="checkbox"
    aria-checked={item.is_checked}
    aria-label={checkLabel}
    onclick={onToggleCheck}
  >
    {#if item.is_checked}<Check size={18} />{/if}
  </button>

  <div class="body">
    <div class="name-line">
      <span class="name">{item.display_name}</span>
      {#if item.is_optional}
        <span class="tag tag-optional">{strings.packing_list.optional_tag}</span>
      {/if}
      {#if item.is_manual}
        <span class="tag tag-manual">{strings.packing_list.manual_tag}</span>
      {/if}
    </div>
  </div>

  <div class="actions">
    <Stepper
      value={item.count}
      min={1}
      onChange={onCountChange}
    />
    {#if item.count_was_edited}
      <span class="edited-dot" aria-hidden="true"></span>
    {/if}
  </div>
</div>

<style>
  .row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
  }

  .row.checked {
    background: var(--color-success-soft);
    border-color: transparent;
  }

  .row.checked .name {
    text-decoration: line-through;
    color: var(--color-text-muted);
  }

  .checkbox {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: var(--radius-sm);
    border: 2px solid var(--color-border);
    background: var(--color-surface);
    color: var(--color-primary);
    cursor: pointer;
    flex-shrink: 0;
  }

  .checkbox.dashed {
    border-style: dashed;
  }

  .row.checked .checkbox {
    background: var(--color-success);
    border-color: var(--color-success);
    color: white;
  }

  .body {
    flex: 1;
    min-width: 0;
  }

  .name-line {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-wrap: wrap;
  }

  .name {
    font-size: var(--fs-row);
    word-break: break-word;
  }

  .tag {
    display: inline-flex;
    align-items: center;
    padding: 2px 6px;
    border-radius: var(--radius-sm);
    font-size: var(--fs-meta);
    line-height: 1.1;
  }

  .tag-optional {
    border: 1px dashed var(--color-border);
    color: var(--color-text-muted);
  }

  .tag-manual {
    background: var(--color-warning-soft);
    color: var(--color-warning);
  }

  .actions {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-shrink: 0;
  }

  .edited-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--color-warning);
  }
</style>
