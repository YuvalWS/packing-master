<script lang="ts">
  interface Props {
    message: string | null;
    onDismiss?: () => void;
    durationMs?: number;
    tone?: 'info' | 'success' | 'danger';
    /** An action button inside the toast, e.g. Undo. */
    action?: { label: string; onClick: () => void } | null;
  }

  let { message, onDismiss, durationMs = 3000, tone = 'info', action = null }: Props = $props();

  let timer: ReturnType<typeof setTimeout> | null = null;

  $effect(() => {
    if (message && onDismiss) {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        onDismiss();
      }, durationMs);
    }
    return () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };
  });
</script>

{#if message}
  <div class="toast" class:has-action={action} data-tone={tone} role="status" aria-live="polite">
    {message}
    {#if action}
      <button type="button" class="toast-action" onclick={action.onClick}>{action.label}</button>
    {/if}
  </div>
{/if}

<style>
  .toast {
    position: fixed;
    inset-block-end: var(--space-5);
    inset-inline-start: 50%;
    transform: translateX(-50%);
    z-index: var(--z-toast);
    padding: var(--space-3) var(--space-5);
    border-radius: var(--radius-pill);
    background: #111827;
    color: white;
    font-size: var(--fs-meta);
    box-shadow: var(--shadow-md);
    pointer-events: none;
  }

  /* inset-inline-start resolves to `right` in RTL; centering needs +50%. */
  :global(html[dir='rtl']) .toast {
    transform: translateX(50%);
  }

  /* Center within the content area beside the permanent sidebar. */
  @media (min-width: 960px) {
    .toast {
      inset-inline-start: calc(50% + (var(--drawer-width) / 2));
    }
  }

  .toast.has-action {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    pointer-events: auto;
  }

  .toast-action {
    color: #93c5fd;
    font-weight: 700;
    font-size: var(--fs-body);
    cursor: pointer;
  }

  .toast[data-tone='danger'] {
    background: var(--color-danger);
  }

  .toast[data-tone='success'] {
    background: var(--color-success);
  }
</style>
