<script lang="ts">
  import type { Snippet } from 'svelte';
  import { onMount } from 'svelte';
  import { page, navigating } from '$app/state';
  import AppShell from '$lib/components/AppShell.svelte';
  import strings from '$lib/strings.js';
  import '$lib/styles/tokens.css';
  import '$lib/styles/global.css';

  interface Props {
    children: Snippet;
  }

  let { children }: Props = $props();

  onMount(() => {
    document.documentElement.dataset.hydrated = 'true';
  });

  function resolveTitle(pathname: string): string {
    if (pathname === '/' || pathname.startsWith('/trips')) return strings.nav.trips;
    if (pathname.startsWith('/items')) return strings.nav.items;
    if (pathname.startsWith('/templates')) return strings.nav.templates;
    return strings.app.title;
  }

  const title = $derived(resolveTitle(page.url.pathname));

  /* Slow-navigation feedback: show a thin top bar only when a client-side
     navigation takes longer than 150ms, so quick hops never flash it. */
  let showProgress = $state(false);
  $effect(() => {
    if (navigating.to) {
      const timer = setTimeout(() => (showProgress = true), 150);
      return () => {
        clearTimeout(timer);
        showProgress = false;
      };
    }
  });
</script>

{#if showProgress}
  <div class="nav-progress" role="progressbar" aria-label={strings.a11y.loading}></div>
{/if}

<AppShell {title} currentPath={page.url.pathname}>
  {@render children()}
</AppShell>

<style>
  .nav-progress {
    position: fixed;
    inset-block-start: 0;
    inset-inline: 0;
    height: 3px;
    z-index: var(--z-toast);
    background: linear-gradient(
      90deg,
      var(--color-primary-soft),
      var(--color-primary),
      var(--color-primary-soft)
    );
    background-size: 200% 100%;
    animation: nav-progress-slide 1s linear infinite;
  }

  @keyframes nav-progress-slide {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: 0 0;
    }
  }
</style>
