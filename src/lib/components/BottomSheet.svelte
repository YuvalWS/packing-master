<script lang="ts">
  import type { Snippet } from 'svelte';
  import { X } from '@lucide/svelte';
  import strings from '$lib/strings.js';

  interface Props {
    open: boolean;
    title: string;
    onClose: () => void;
    children: Snippet;
  }

  let { open, title, onClose, children }: Props = $props();

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }
</script>

<svelte:window onkeydown={open ? onKey : undefined} />

{#if open}
  <div class="backdrop" onclick={onClose} role="presentation"></div>
  <div class="sheet" role="dialog" aria-modal="true" aria-label={title}>
    <header>
      <h2>{title}</h2>
      <button type="button" class="icon-btn" aria-label={strings.a11y.close_menu} onclick={onClose}>
        <X size={20} />
      </button>
    </header>
    <div class="body">
      {@render children()}
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(17, 24, 39, 0.45);
    z-index: var(--z-modal-backdrop);
  }

  .sheet {
    position: fixed;
    inset-block-end: 0;
    inset-inline: 0;
    z-index: var(--z-modal);
    max-height: 80vh;
    background: var(--color-surface);
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    box-shadow: var(--shadow-lg);
    display: flex;
    flex-direction: column;
    animation: slide-up 0.18s ease-out;
  }

  @keyframes slide-up {
    from {
      transform: translateY(100%);
    }
    to {
      transform: translateY(0);
    }
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-4);
    border-block-end: 1px solid var(--color-border);
  }

  header h2 {
    font-size: var(--fs-row);
    font-weight: 700;
  }

  .icon-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: var(--radius-md);
    color: var(--color-text-muted);
  }

  .icon-btn:hover {
    background: var(--color-bg);
    color: var(--color-text);
  }

  .body {
    flex: 1;
    overflow-y: auto;
    padding: var(--space-4);
  }
</style>
