<script lang="ts">
  import type { Snippet } from 'svelte';
  import TopAppBar from './TopAppBar.svelte';
  import NavigationDrawer from './NavigationDrawer.svelte';

  interface Props {
    title: string;
    currentPath?: string;
    onSettingsClick?: () => void;
    children: Snippet;
  }

  let { title, currentPath, onSettingsClick, children }: Props = $props();

  let drawerOpen = $state(false);
</script>

<div class="shell">
  <TopAppBar
    {title}
    {onSettingsClick}
    onMenuClick={() => (drawerOpen = true)}
  />

  <NavigationDrawer
    open={drawerOpen}
    onClose={() => (drawerOpen = false)}
    {currentPath}
  />

  <main class="content">
    {@render children()}
  </main>
</div>

<style>
  .shell {
    min-height: 100vh;
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
  }

  .content {
    flex: 1;
    width: 100%;
    max-width: var(--layout-max-width);
    margin-inline: auto;
    padding: var(--space-4);
    padding-block-end: var(--fab-clearance);
  }
</style>
