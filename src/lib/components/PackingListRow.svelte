<script lang="ts">
  import { Check, ChevronDown } from '@lucide/svelte';
  import Stepper from './Stepper.svelte';
  import type { EnrichedItem } from '$lib/client/api.js';
  import strings from '$lib/strings.js';

  interface Props {
    item: EnrichedItem;
    partial?: boolean;
    expandable?: boolean;
    expanded?: boolean;
    onToggleCheck: () => void;
    onCountChange: (next: number) => void;
    onToggleExpand?: () => void;
  }

  let {
    item,
    partial = false,
    expandable = false,
    expanded = false,
    onToggleCheck,
    onCountChange,
    onToggleExpand
  }: Props = $props();

  const checkLabel = $derived(strings.a11y_row.toggle_check.replace('{name}', item.display_name));
</script>

<div class="row" class:checked={item.is_checked} class:optional={item.is_optional}>
  <button
    type="button"
    class="checkbox"
    class:dashed={item.is_optional}
    class:partial
    role="checkbox"
    aria-checked={partial ? 'mixed' : item.is_checked}
    aria-label={checkLabel}
    onclick={onToggleCheck}
  >
    {#if item.is_checked}
      <Check size={18} />
    {:else if partial}
      <span class="partial-dot" aria-hidden="true"></span>
    {/if}
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
    {#if expandable && onToggleExpand}
      <button
        type="button"
        class="expand-btn"
        class:expanded
        aria-expanded={expanded}
        aria-label={strings.a11y_row.row_menu}
        onclick={onToggleExpand}
      >
        <ChevronDown size={18} />
      </button>
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

  .partial-dot {
    width: 10px;
    height: 10px;
    border-radius: 2px;
    background: var(--color-primary);
  }

  .checkbox.partial {
    border-color: var(--color-primary);
  }

  .expand-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: var(--radius-sm);
    color: var(--color-text-muted);
    cursor: pointer;
    transition: transform 0.18s ease;
  }

  .expand-btn:hover {
    color: var(--color-primary);
    background: var(--color-primary-soft);
  }

  .expand-btn.expanded {
    transform: rotate(180deg);
  }
</style>
