<script lang="ts">
  import type { Snippet } from 'svelte';
  import { onMount } from 'svelte';
  import { page } from '$app/state';
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
</script>

<AppShell {title} currentPath={page.url.pathname}>
  {@render children()}
</AppShell>
