<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    href?: string;
    ariaLabel: string;
    onclick?: () => void;
    children: Snippet;
  }

  let { href, ariaLabel, onclick, children }: Props = $props();
</script>

{#if href}
  <a class="fab" {href} aria-label={ariaLabel}>
    {@render children()}
  </a>
{:else}
  <button type="button" class="fab" aria-label={ariaLabel} {onclick}>
    {@render children()}
  </button>
{/if}

<style>
  .fab {
    position: fixed;
    inset-block-end: var(--space-5);
    inset-inline-end: var(--space-5);
    z-index: var(--z-fab);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 56px;
    height: 56px;
    border-radius: var(--radius-pill);
    background: var(--color-primary);
    color: white;
    box-shadow: var(--shadow-lg);
    cursor: pointer;
    transition: transform 0.12s ease, box-shadow 0.12s ease;
  }

  .fab:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 28px rgba(37, 99, 235, 0.4);
    text-decoration: none;
  }

  .fab:active {
    transform: translateY(0);
  }
</style>
