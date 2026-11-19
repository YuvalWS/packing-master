import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/svelte';
import RowActionsSheet from '../../src/lib/components/RowActionsSheet.svelte';
import type { EnrichedItem } from '../../src/lib/client/api.js';
import strings from '../../src/lib/strings.js';

afterEach(cleanup);

function item(overrides: Partial<EnrichedItem> = {}): EnrichedItem {
  return {
    row_id: 1,
    item_id: 'item_a',
    display_name: 'Sample Item',
    category: 'general',
    default_bag: 'main_bag',
    is_kit: false,
    is_optional: false,
    kit_contents: null,
    count: 3,
    is_checked: false,
    is_manual: false,
    bag_distribution: null,
    notes: null,
    count_was_edited: false,
    ...overrides
  };
}

function noopHandlers() {
  return {
    onSaveNote: vi.fn().mockResolvedValue(undefined),
    onSaveSplit: vi.fn().mockResolvedValue(undefined),
    onDelete: vi.fn().mockResolvedValue(undefined),
    onClose: vi.fn()
  };
}

describe('RowActionsSheet', () => {
  it('does not render when item is null', () => {
    render(RowActionsSheet, {
      props: { item: null, knownBags: [], ...noopHandlers() }
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('menu shows split, note and delete actions for generated items too', () => {
    render(RowActionsSheet, {
      props: { item: item({ is_manual: false }), knownBags: [], ...noopHandlers() }
    });
    expect(screen.getByText(strings.row_menu.split_bags)).toBeInTheDocument();
    expect(screen.getByText(strings.row_menu.note)).toBeInTheDocument();
    expect(screen.getByText(strings.row_menu.delete)).toBeInTheDocument();
  });

  it('delete calls onDelete at once (the page offers Undo instead of a confirm step)', async () => {
    const handlers = noopHandlers();
    render(RowActionsSheet, {
      props: { item: item({ is_manual: false }), knownBags: [], ...handlers }
    });
    await fireEvent.click(screen.getByRole('button', { name: strings.row_menu.delete }));
    expect(handlers.onDelete).toHaveBeenCalledOnce();
  });

  it('note view prefills existing note and saves the trimmed text', async () => {
    const handlers = noopHandlers();
    const it_ = item({ notes: 'old note' });
    render(RowActionsSheet, {
      props: { item: it_, knownBags: [], ...handlers }
    });
    await fireEvent.click(screen.getByText(strings.row_menu.note));
    const textarea = screen.getByRole('textbox', {
      name: strings.row_menu.note
    }) as HTMLTextAreaElement;
    expect(textarea.value).toBe('old note');
    await fireEvent.input(textarea, { target: { value: '  new note  ' } });
    await fireEvent.click(screen.getByRole('button', { name: strings.common.save }));
    expect(handlers.onSaveNote).toHaveBeenCalledWith(it_, 'new note');
  });

  it('clearing the note saves null', async () => {
    const handlers = noopHandlers();
    const it_ = item({ notes: 'old note' });
    render(RowActionsSheet, {
      props: { item: it_, knownBags: [], ...handlers }
    });
    await fireEvent.click(screen.getByText(strings.row_menu.note));
    const textarea = screen.getByRole('textbox', { name: strings.row_menu.note });
    await fireEvent.input(textarea, { target: { value: '   ' } });
    await fireEvent.click(screen.getByRole('button', { name: strings.common.save }));
    expect(handlers.onSaveNote).toHaveBeenCalledWith(it_, null);
  });

  it('bag split disables save until the total matches the count', async () => {
    const handlers = noopHandlers();
    const it_ = item({ count: 3, default_bag: 'main_bag' });
    render(RowActionsSheet, {
      props: { item: it_, knownBags: ['main_bag', 'small_bag'], ...handlers }
    });
    await fireEvent.click(screen.getByText(strings.row_menu.split_bags));

    const save = screen.getByRole('button', { name: strings.common.save });
    // Initial draft assigns the full count to the default bag: valid.
    expect(save).toBeEnabled();

    // Move one unit to the second bag: total becomes 4 → invalid.
    const incButtons = screen.getAllByRole('button', { name: strings.a11y_row.increment });
    await fireEvent.click(incButtons[1]!);
    expect(save).toBeDisabled();

    // Remove one from the first bag: total back to 3 → valid again.
    const decButtons = screen.getAllByRole('button', { name: strings.a11y_row.decrement });
    await fireEvent.click(decButtons[0]!);
    expect(save).toBeEnabled();

    await fireEvent.click(save);
    expect(handlers.onSaveSplit).toHaveBeenCalledWith(it_, { main_bag: 2, small_bag: 1 });
  });

  it('collapsing the split back to the default bag saves null', async () => {
    const handlers = noopHandlers();
    const it_ = item({
      count: 2,
      default_bag: 'main_bag',
      bag_distribution: { main_bag: 1, small_bag: 1 }
    });
    render(RowActionsSheet, {
      props: { item: it_, knownBags: ['main_bag', 'small_bag'], ...handlers }
    });
    await fireEvent.click(screen.getByText(strings.row_menu.split_bags));

    const incButtons = screen.getAllByRole('button', { name: strings.a11y_row.increment });
    const decButtons = screen.getAllByRole('button', { name: strings.a11y_row.decrement });
    await fireEvent.click(incButtons[0]!);
    await fireEvent.click(decButtons[1]!);

    await fireEvent.click(screen.getByRole('button', { name: strings.common.save }));
    expect(handlers.onSaveSplit).toHaveBeenCalledWith(it_, null);
  });
});
