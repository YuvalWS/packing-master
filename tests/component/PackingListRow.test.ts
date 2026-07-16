import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/svelte';
import PackingListRow from '../../src/lib/components/PackingListRow.svelte';
import type { EnrichedItem } from '../../src/lib/client/api.js';
import strings from '../../src/lib/strings.js';

afterEach(cleanup);

function row(overrides: Partial<EnrichedItem> = {}): EnrichedItem {
  return {
    row_id: 1,
    item_id: 'item_a',
    display_name: 'Sample Item',
    category: 'general',
    default_bag: 'main_bag',
    is_kit: false,
    is_optional: false,
    kit_contents: null,
    count: 2,
    is_checked: false,
    is_manual: false,
    bag_distribution: null,
    notes: null,
    count_was_edited: false,
    ...overrides
  };
}

describe('PackingListRow', () => {
  it('invokes onToggleCheck when the checkbox is clicked', async () => {
    const onToggleCheck = vi.fn();
    render(PackingListRow, {
      props: { item: row(), onToggleCheck, onCountChange: vi.fn() }
    });
    await fireEvent.click(screen.getByRole('checkbox'));
    expect(onToggleCheck).toHaveBeenCalledOnce();
  });

  it('reflects is_checked via aria-checked', () => {
    const { rerender } = render(PackingListRow, {
      props: { item: row({ is_checked: true }), onToggleCheck: vi.fn(), onCountChange: vi.fn() }
    });
    expect(screen.getByRole('checkbox')).toHaveAttribute('aria-checked', 'true');
  });

  it('shows optional tag and dashed checkbox for optional items', () => {
    render(PackingListRow, {
      props: { item: row({ is_optional: true }), onToggleCheck: vi.fn(), onCountChange: vi.fn() }
    });
    expect(screen.getByText(strings.packing_list.optional_tag)).toBeInTheDocument();
    expect(screen.getByRole('checkbox').className).toContain('dashed');
  });

  it('shows manual tag for is_manual items', () => {
    render(PackingListRow, {
      props: { item: row({ is_manual: true }), onToggleCheck: vi.fn(), onCountChange: vi.fn() }
    });
    expect(screen.getByText(strings.packing_list.manual_tag)).toBeInTheDocument();
  });

  it('emits new count via onCountChange when stepper plus is clicked', async () => {
    const onCountChange = vi.fn();
    render(PackingListRow, {
      props: { item: row({ count: 3 }), onToggleCheck: vi.fn(), onCountChange }
    });
    await fireEvent.click(screen.getByRole('button', { name: strings.a11y_row.increment }));
    expect(onCountChange).toHaveBeenCalledWith(4);
  });

  it('renders a row-menu button only when onOpenMenu is provided, and fires it', async () => {
    const { unmount } = render(PackingListRow, {
      props: { item: row(), onToggleCheck: vi.fn(), onCountChange: vi.fn() }
    });
    expect(
      screen.queryByRole('button', { name: strings.a11y_row.row_menu })
    ).not.toBeInTheDocument();
    unmount();

    const onOpenMenu = vi.fn();
    render(PackingListRow, {
      props: { item: row(), onToggleCheck: vi.fn(), onCountChange: vi.fn(), onOpenMenu }
    });
    await fireEvent.click(screen.getByRole('button', { name: strings.a11y_row.row_menu }));
    expect(onOpenMenu).toHaveBeenCalledOnce();
  });

  it('shows a note indicator when the item has notes', () => {
    render(PackingListRow, {
      props: { item: row({ notes: 'remember this' }), onToggleCheck: vi.fn(), onCountChange: vi.fn() }
    });
    expect(screen.getByLabelText(strings.a11y_row.has_note)).toBeInTheDocument();
  });

  it('split rows show the per-bag count with a disabled stepper', () => {
    render(PackingListRow, {
      props: {
        item: row({ count: 5 }),
        displayCount: 2,
        stepperDisabled: true,
        onToggleCheck: vi.fn(),
        onCountChange: vi.fn()
      }
    });
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: strings.a11y_row.increment })).toBeDisabled();
    expect(screen.getByRole('button', { name: strings.a11y_row.decrement })).toBeDisabled();
  });
});
