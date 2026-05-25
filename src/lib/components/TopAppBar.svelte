<script lang="ts">
  import { Menu, Settings } from '@lucide/svelte';
  import strings from '$lib/strings.js';

  interface Props {
    title: string;
    onMenuClick: () => void;
    onSettingsClick?: () => void;
  }

  let { title, onMenuClick, onSettingsClick }: Props = $props();
</script>

<header class="topbar">
  <button
    type="button"
    class="icon-btn menu-btn"
    aria-label={strings.a11y.open_menu}
    onclick={onMenuClick}
  >
    <Menu size={24} />
  </button>

  <h1 class="title">{title}</h1>

  {#if onSettingsClick}
    <button
      type="button"
      class="icon-btn"
      aria-label={strings.a11y.settings}
      onclick={onSettingsClick}
    >
      <Settings size={22} />
    </button>
  {:else}
    <span class="icon-btn-spacer" aria-hidden="true"></span>
  {/if}
</header>

<style>
  .topbar {
    position: sticky;
    inset-block-start: 0;
    z-index: var(--z-topbar);
    display: flex;
    align-items: center;
    gap: var(--space-3);
    height: var(--topbar-height);
    padding-inline: var(--space-4);
    background: var(--color-surface);
    border-block-end: 1px solid var(--color-border);
  }

  .title {
    flex: 1;
    font-size: var(--fs-title);
    font-weight: 700;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .icon-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: var(--radius-md);
    color: var(--color-text);
    transition: background 0.12s ease;
  }

  .icon-btn:hover:not(:disabled) {
    background: var(--color-primary-soft);
  }

  .icon-btn-spacer {
    width: 40px;
    height: 40px;
    flex-shrink: 0;
  }

  @media (min-width: 960px) {
    .menu-btn {
      display: none;
    }
  }
</style>
