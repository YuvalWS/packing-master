import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/svelte';
import AppShell from '../../src/lib/components/AppShell.svelte';
import strings from '../../src/lib/strings.js';
import { createRawSnippet } from 'svelte';

afterEach(cleanup);

function bodySnippet(text: string) {
  return createRawSnippet(() => ({
    render: () => `<div data-testid="content">${text}</div>`
  }));
}

describe('AppShell', () => {
  it('renders the provided title and slot content', () => {
    render(AppShell, {
      props: {
        title: 'Hello',
        children: bodySnippet('payload')
      }
    });
    expect(screen.getByRole('heading', { name: 'Hello' })).toBeInTheDocument();
    expect(screen.getByTestId('content')).toHaveTextContent('payload');
  });

  it('drawer is closed by default and opens on hamburger click', async () => {
    render(AppShell, {
      props: {
        title: 'Hello',
        children: bodySnippet('x')
      }
    });
    const openBtn = screen.getByRole('button', { name: strings.a11y.open_menu });
    const drawer = screen.getByRole('complementary', { hidden: true });
    expect(drawer).toHaveAttribute('aria-hidden', 'true');

    await fireEvent.click(openBtn);
    expect(drawer).toHaveAttribute('aria-hidden', 'false');
  });

  it('drawer closes when the close button is clicked', async () => {
    render(AppShell, {
      props: {
        title: 'Hello',
        children: bodySnippet('x')
      }
    });
    await fireEvent.click(screen.getByRole('button', { name: strings.a11y.open_menu }));
    const drawer = screen.getByRole('complementary', { hidden: true });
    expect(drawer).toHaveAttribute('aria-hidden', 'false');

    await fireEvent.click(screen.getByRole('button', { name: strings.a11y.close_menu }));
    expect(drawer).toHaveAttribute('aria-hidden', 'true');
  });

  it('hides the settings button entirely when no handler is provided', () => {
    render(AppShell, {
      props: {
        title: 'Hello',
        children: bodySnippet('x')
      }
    });
    expect(
      screen.queryByRole('button', { name: strings.a11y.settings })
    ).not.toBeInTheDocument();
  });

  it('renders an enabled settings button when a handler is provided', async () => {
    let clicked = false;
    render(AppShell, {
      props: {
        title: 'Hello',
        onSettingsClick: () => {
          clicked = true;
        },
        children: bodySnippet('x')
      }
    });
    const settingsBtn = screen.getByRole('button', { name: strings.a11y.settings });
    expect(settingsBtn).not.toBeDisabled();
    await fireEvent.click(settingsBtn);
    expect(clicked).toBe(true);
  });

  it('renders nav links with Hebrew labels from strings.json', async () => {
    render(AppShell, {
      props: {
        title: 'Hello',
        currentPath: '/items',
        children: bodySnippet('x')
      }
    });
    await fireEvent.click(screen.getByRole('button', { name: strings.a11y.open_menu }));
    expect(screen.getByRole('link', { name: new RegExp(strings.nav.trips) })).toBeInTheDocument();
    const itemsLink = screen.getByRole('link', { name: new RegExp(strings.nav.items) });
    expect(itemsLink).toBeInTheDocument();
    expect(itemsLink.className).toContain('active');
  });
});
