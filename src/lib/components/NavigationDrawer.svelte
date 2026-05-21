<script lang="ts">
  import { X, Backpack, Package, LayoutTemplate } from '@lucide/svelte';
  import strings from '$lib/strings.js';

  interface Props {
    open: boolean;
    onClose: () => void;
    currentPath?: string;
  }

  let { open, onClose, currentPath = '/' }: Props = $props();

  const links = [
    { href: '/', label: strings.nav.trips, icon: Backpack },
    { href: '/items', label: strings.nav.items, icon: Package },
    { href: '/templates', label: strings.nav.templates, icon: LayoutTemplate }
  ];

  function isActive(href: string): boolean {
    if (href === '/') return currentPath === '/';
    return currentPath === href || currentPath.startsWith(href + '/');
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }
</script>

<svelte:window onkeydown={open ? onKey : undefined} />

{#if open}
  <div
    class="backdrop"
    onclick={onClose}
    onkeydown={onKey}
    role="presentation"
  ></div>
{/if}

<aside
  class="drawer"
  class:open
  aria-hidden={!open}
  aria-label={strings.nav.trips}
>
  <div class="drawer-head">
    <button
      type="button"
      class="icon-btn"
      aria-label={strings.a11y.close_menu}
      onclick={onClose}
      tabindex={open ? 0 : -1}
    >
      <X size={22} />
    </button>
  </div>
  <nav>
    <ul>
      {#each links as link (link.href)}
        {@const Icon = link.icon}
        <li>
          <a
            href={link.href}
            class:active={isActive(link.href)}
            onclick={onClose}
            tabindex={open ? 0 : -1}
          >
            <Icon size={20} />
            <span>{link.label}</span>
          </a>
        </li>
      {/each}
    </ul>
  </nav>
</aside>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(17, 24, 39, 0.4);
    z-index: var(--z-drawer-backdrop);
  }

  .drawer {
    position: fixed;
    inset-block: 0;
    inset-inline-start: 0;
    width: var(--drawer-width);
    max-width: 85vw;
    background: var(--color-surface);
    z-index: var(--z-drawer);
    transform: translateX(100%);
    transition: transform 0.2s ease;
    box-shadow: var(--shadow-lg);
    display: flex;
    flex-direction: column;
  }

  :global(html[dir='rtl']) .drawer {
    transform: translateX(-100%);
  }

  .drawer.open {
    transform: translateX(0);
  }

  .drawer-head {
    display: flex;
    justify-content: flex-end;
    padding: var(--space-3);
    border-block-end: 1px solid var(--color-border);
  }

  .icon-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: var(--radius-md);
    color: var(--color-text);
  }

  .icon-btn:hover {
    background: var(--color-primary-soft);
  }

  nav {
    padding: var(--space-3);
  }

  ul {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  a {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius-md);
    color: var(--color-text);
    font-size: var(--fs-row);
    font-weight: 500;
  }

  a:hover {
    background: var(--color-primary-soft);
    text-decoration: none;
  }

  a.active {
    background: var(--color-primary-soft);
    color: var(--color-primary);
  }
</style>
