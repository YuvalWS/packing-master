<script lang="ts">
  import strings from '$lib/strings.js';

  type Mode = 'category' | 'bag';

  interface Props {
    mode: Mode;
    onChange: (next: Mode) => void;
  }

  let { mode, onChange }: Props = $props();
</script>

<div class="toggle" role="tablist" aria-label={strings.view.by_category}>
  <button
    type="button"
    role="tab"
    aria-selected={mode === 'category'}
    class:active={mode === 'category'}
    onclick={() => onChange('category')}
  >
    {strings.view.by_category}
  </button>
  <button
    type="button"
    role="tab"
    aria-selected={mode === 'bag'}
    class:active={mode === 'bag'}
    onclick={() => onChange('bag')}
  >
    {strings.view.by_bag}
  </button>
</div>

<style>
  .toggle {
    display: inline-flex;
    padding: 4px;
    border-radius: var(--radius-pill);
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    gap: 4px;
  }

  button {
    padding: var(--space-1) var(--space-4);
    border-radius: var(--radius-pill);
    font-size: var(--fs-meta);
    color: var(--color-text-muted);
    cursor: pointer;
    background: transparent;
  }

  button.active {
    background: var(--color-surface);
    color: var(--color-text);
    box-shadow: var(--shadow-sm);
  }
</style>
