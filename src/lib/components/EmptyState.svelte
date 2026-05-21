<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    title: string;
    message?: string;
    icon?: Snippet;
    action?: Snippet;
  }

  let { title, message, icon, action }: Props = $props();
</script>

<div class="empty">
  {#if icon}
    <div class="icon">{@render icon()}</div>
  {/if}
  <h2 class="title">{title}</h2>
  {#if message}
    <p class="message">{message}</p>
  {/if}
  {#if action}
    <div class="action">{@render action()}</div>
  {/if}
</div>

<style>
  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: var(--space-3);
    padding: var(--space-7) var(--space-4);
    color: var(--color-text-muted);
  }

  .icon {
    color: var(--color-text-muted);
  }

  .title {
    color: var(--color-text);
    font-size: var(--fs-title);
    font-weight: 700;
  }

  .message {
    max-width: 36ch;
    color: var(--color-text-muted);
  }

  .action {
    margin-block-start: var(--space-3);
  }
</style>
