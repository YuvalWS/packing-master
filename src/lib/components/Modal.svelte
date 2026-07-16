<script lang="ts">
  import type { Snippet } from 'svelte';
  import { X } from '@lucide/svelte';
  import strings from '$lib/strings.js';

  interface Props {
    open: boolean;
    title: string;
    onClose: () => void;
    children: Snippet;
    footer?: Snippet;
  }

  let { open, title, onClose, children, footer }: Props = $props();

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }
</script>

<svelte:window onkeydown={open ? onKey : undefined} />

{#if open}
  <div class="backdrop" onclick={onClose} role="presentation"></div>
  <div class="modal" role="dialog" aria-modal="true" aria-label={title}>
    <header>
      <h2>{title}</h2>
      <button type="button" class="icon-btn" aria-label={strings.a11y.close_menu} onclick={onClose}>
        <X size={20} />
      </button>
    </header>
    <div class="body">
      {@render children()}
    </div>
    {#if footer}
      <footer>
        {@render footer()}
      </footer>
    {/if}
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(17, 24, 39, 0.45);
    z-index: var(--z-modal-backdrop);
  }

  .modal {
    position: fixed;
    inset-block-start: 50%;
    inset-inline-start: 50%;
    transform: translate(-50%, -50%);
    z-index: var(--z-modal);
    width: min(560px, calc(100vw - 32px));
    max-height: calc(100vh - 64px);
    display: flex;
    flex-direction: column;
    background: var(--color-surface);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    overflow: hidden;
  }

  /* inset-inline-start resolves to `right` in RTL; transforms are
     direction-agnostic, so centering needs +50% there, not -50%. */
  :global(html[dir='rtl']) .modal {
    transform: translate(50%, -50%);
  }

  /* The permanent sidebar (≥960px) shifts the content area by the drawer
     width; center overlays in the remaining viewport, not the full one. */
  @media (min-width: 960px) {
    .modal {
      inset-inline-start: calc(50% + (var(--drawer-width) / 2));
    }
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-4);
    border-block-end: 1px solid var(--color-border);
  }

  header h2 {
    font-size: var(--fs-title);
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
    overflow-y: auto;
    padding: var(--space-4);
  }

  footer {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
    padding: var(--space-4);
    border-block-start: 1px solid var(--color-border);
  }
</style>
