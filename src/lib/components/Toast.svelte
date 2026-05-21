<script lang="ts">
  interface Props {
    message: string | null;
    onDismiss?: () => void;
    durationMs?: number;
    tone?: 'info' | 'success' | 'danger';
  }

  let { message, onDismiss, durationMs = 3000, tone = 'info' }: Props = $props();

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
  <div class="toast" data-tone={tone} role="status" aria-live="polite">
    {message}
  </div>
{/if}

<style>
  .toast {
    position: fixed;
    inset-block-end: var(--space-5);
    inset-inline-start: 50%;
    transform: translateX(50%);
    z-index: var(--z-toast);
    padding: var(--space-3) var(--space-5);
    border-radius: var(--radius-pill);
    background: #111827;
    color: white;
    font-size: var(--fs-meta);
    box-shadow: var(--shadow-md);
    pointer-events: none;
  }

  :global(html[dir='rtl']) .toast {
    transform: translateX(-50%);
  }

  .toast[data-tone='danger'] {
    background: var(--color-danger);
  }

  .toast[data-tone='success'] {
    background: var(--color-success);
  }
</style>
