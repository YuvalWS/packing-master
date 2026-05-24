import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/svelte';
import ManualAddSheet from '../../src/lib/components/ManualAddSheet.svelte';
import strings from '../../src/lib/strings.js';

afterEach(cleanup);

beforeEach(() => {
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url === '/api/items' && (!init || init.method === undefined || init.method === 'GET')) {
      return new Response(
        JSON.stringify({
          items: [
            { id: 'item_a', display_name: 'Catalog A', category: 'cat_general' },
            { id: 'item_b', display_name: 'Catalog B', category: 'cat_clothing' }
          ]
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    }
    if (url.endsWith('/items') && init?.method === 'POST') {
      return new Response(JSON.stringify({ item: { id: 999 } }), {
        status: 201,
        headers: { 'content-type': 'application/json' }
      });
    }
    return new Response('not found', { status: 404 });
  }) as unknown as typeof fetch;
});

describe('ManualAddSheet', () => {
  it('does not render when closed', () => {
    render(ManualAddSheet, {
      props: {
        open: false,
        tripId: 1,
        existingItemIds: new Set<string>(),
        onAdded: vi.fn(),
        onClose: vi.fn(),
        onError: vi.fn()
      }
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows both tabs and a search input when open', async () => {
    render(ManualAddSheet, {
      props: {
        open: true,
        tripId: 1,
        existingItemIds: new Set<string>(),
        onAdded: vi.fn(),
        onClose: vi.fn(),
        onError: vi.fn()
      }
    });
    expect(screen.getByRole('tab', { name: strings.manual_add.tab_catalog })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: strings.manual_add.tab_free_text })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(strings.manual_add.search_placeholder)).toBeInTheDocument();
  });

  it('filters out items already in the trip', async () => {
    render(ManualAddSheet, {
      props: {
        open: true,
        tripId: 1,
        existingItemIds: new Set(['item_a']),
        onAdded: vi.fn(),
        onClose: vi.fn(),
        onError: vi.fn()
      }
    });
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByText('Catalog A')).not.toBeInTheDocument();
    expect(await screen.findByText('Catalog B')).toBeInTheDocument();
  });

  it('switches to the free-text form when its tab is clicked', async () => {
    render(ManualAddSheet, {
      props: {
        open: true,
        tripId: 1,
        existingItemIds: new Set<string>(),
        onAdded: vi.fn(),
        onClose: vi.fn(),
        onError: vi.fn()
      }
    });
    await fireEvent.click(screen.getByRole('tab', { name: strings.manual_add.tab_free_text }));
    expect(screen.getByLabelText(strings.manual_add.free_text_placeholder)).toBeInTheDocument();
  });

  it('rejects empty free-text submissions via onError', async () => {
    const onError = vi.fn();
    render(ManualAddSheet, {
      props: {
        open: true,
        tripId: 1,
        existingItemIds: new Set<string>(),
        onAdded: vi.fn(),
        onClose: vi.fn(),
        onError
      }
    });
    await fireEvent.click(screen.getByRole('tab', { name: strings.manual_add.tab_free_text }));
    // The HTML "required" attribute would normally block submission; we
    // simulate submit() being invoked even when empty by clearing then
    // submitting via the form's submit event.
    const form = screen.getByLabelText(strings.manual_add.free_text_placeholder).closest('form');
    expect(form).not.toBeNull();
    await fireEvent.submit(form!);
    expect(onError).toHaveBeenCalledWith(strings.manual_add.free_text_empty);
  });
});
