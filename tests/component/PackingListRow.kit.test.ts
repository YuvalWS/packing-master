import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/svelte';
import PackingListRow from '../../src/lib/components/PackingListRow.svelte';
import type { EnrichedItem } from '../../src/lib/client/api.js';

afterEach(cleanup);

function kit(overrides: Partial<EnrichedItem> = {}): EnrichedItem {
  return {
    row_id: 1,
    item_id: 'item_kit',
    display_name: 'Kit Bag',
    category: 'kit',
    default_bag: 'main_bag',
    is_kit: true,
    is_optional: false,
    kit_contents: [
      { id: 'kit_comp_one', display_name: 'Comp One', default_count: 1 },
      { id: 'kit_comp_two', display_name: 'Comp Two', default_count: 1 }
    ],
    count: 1,
    is_checked: false,
    is_manual: false,
    bag_distribution: null,
    notes: null,
    count_was_edited: false,
    ...overrides
  };
}

describe('PackingListRow kit mode', () => {
  it('renders an expand button when expandable=true', () => {
    render(PackingListRow, {
      props: {
        item: kit(),
        expandable: true,
        expanded: false,
        onToggleCheck: vi.fn(),
        onCountChange: vi.fn(),
        onToggleExpand: vi.fn()
      }
    });
    const expand = screen.getAllByRole('button').find((b) => b.getAttribute('aria-expanded') !== null);
    expect(expand).toBeDefined();
    expect(expand).toHaveAttribute('aria-expanded', 'false');
  });

  it('aria-expanded reflects expanded prop', () => {
    render(PackingListRow, {
      props: {
        item: kit(),
        expandable: true,
        expanded: true,
        onToggleCheck: vi.fn(),
        onCountChange: vi.fn(),
        onToggleExpand: vi.fn()
      }
    });
    const expand = screen.getAllByRole('button').find((b) => b.getAttribute('aria-expanded') !== null);
    expect(expand).toHaveAttribute('aria-expanded', 'true');
  });

  it('sets checkbox aria-checked=mixed when partial', () => {
    render(PackingListRow, {
      props: {
        item: kit(),
        partial: true,
        expandable: true,
        onToggleCheck: vi.fn(),
        onCountChange: vi.fn(),
        onToggleExpand: vi.fn()
      }
    });
    expect(screen.getByRole('checkbox')).toHaveAttribute('aria-checked', 'mixed');
  });

  it('clicking the expand button triggers onToggleExpand', async () => {
    const onToggleExpand = vi.fn();
    render(PackingListRow, {
      props: {
        item: kit(),
        expandable: true,
        expanded: false,
        onToggleCheck: vi.fn(),
        onCountChange: vi.fn(),
        onToggleExpand
      }
    });
    const expand = screen.getAllByRole('button').find((b) => b.getAttribute('aria-expanded') !== null);
    await fireEvent.click(expand!);
    expect(onToggleExpand).toHaveBeenCalledOnce();
  });
});
