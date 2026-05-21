<script lang="ts">
  interface Props {
    label: string;
    active?: boolean;
    muted?: boolean;
    onclick?: () => void;
  }

  let { label, active = false, muted = false, onclick }: Props = $props();

  const isButton = $derived(typeof onclick === 'function');
</script>

{#if isButton}
  <button
    type="button"
    class="chip"
    class:active
    class:muted
    {onclick}
  >
    {label}
  </button>
{:else}
  <span class="chip" class:active class:muted>{label}</span>
{/if}

<style>
  .chip {
    display: inline-flex;
    align-items: center;
    padding: 4px 10px;
    border-radius: var(--radius-pill);
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    color: var(--color-text);
    font-size: var(--fs-meta);
    line-height: 1.2;
    white-space: nowrap;
  }

  .chip.active {
    background: var(--color-primary-soft);
    border-color: var(--color-primary-soft);
    color: var(--color-primary);
  }

  .chip.muted {
    color: var(--color-text-muted);
  }

  button.chip {
    cursor: pointer;
  }

  button.chip:hover {
    border-color: var(--color-primary);
  }
</style>
