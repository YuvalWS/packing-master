<script lang="ts">
  import { Minus, Plus } from '@lucide/svelte';
  import strings from '$lib/strings.js';

  interface Props {
    value: number;
    min?: number;
    max?: number;
    disabled?: boolean;
    onChange: (next: number) => void;
  }

  let { value, min = 0, max = 999, disabled = false, onChange }: Props = $props();

  function dec() {
    if (value > min) onChange(value - 1);
  }

  function inc() {
    if (value < max) onChange(value + 1);
  }
</script>

<div class="stepper" dir="ltr">
  <button
    type="button"
    class="step-btn"
    aria-label={strings.a11y_row.decrement}
    onclick={dec}
    disabled={disabled || value <= min}
  >
    <Minus size={16} />
  </button>
  <span class="value" aria-live="polite">{value}</span>
  <button
    type="button"
    class="step-btn"
    aria-label={strings.a11y_row.increment}
    onclick={inc}
    disabled={disabled || value >= max}
  >
    <Plus size={16} />
  </button>
</div>

<style>
  .stepper {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
  }

  .step-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: var(--radius-sm);
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    color: var(--color-text);
    cursor: pointer;
  }

  .step-btn:hover:not(:disabled) {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  .value {
    min-width: 2ch;
    text-align: center;
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  }
</style>
