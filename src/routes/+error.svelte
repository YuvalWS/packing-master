<script lang="ts">
  import { page } from '$app/state';
  import { AlertTriangle } from '@lucide/svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import strings from '$lib/strings.js';

  const notFound = $derived(page.status === 404);
</script>

<EmptyState
  title={notFound ? strings.error.title_404 : strings.error.title_generic}
  message={notFound ? strings.error.message_404 : strings.error.message_generic}
>
  {#snippet icon()}
    <AlertTriangle size={48} />
  {/snippet}
  {#snippet action()}
    <div class="actions">
      {#if !notFound}
        <button type="button" class="retry" onclick={() => location.reload()}>
          {strings.error.retry}
        </button>
      {/if}
      <a class="home" href="/">{strings.error.go_home}</a>
    </div>
  {/snippet}
</EmptyState>

<style>
  .actions {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    flex-wrap: wrap;
    justify-content: center;
  }

  .retry {
    padding: var(--space-3) var(--space-5);
    border-radius: var(--radius-pill);
    background: var(--color-primary);
    color: white;
    font-weight: 600;
    cursor: pointer;
  }

  .retry:hover {
    background: #1d4ed8;
  }

  .home {
    padding: var(--space-3) var(--space-5);
    border-radius: var(--radius-pill);
    color: var(--color-primary);
  }

  .home:hover {
    background: var(--color-primary-soft);
    text-decoration: none;
  }
</style>
