import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/svelte';
import RegenDiffModal from '../../src/lib/components/RegenDiffModal.svelte';
import type { PatchTripDiffRemoved, OrphanDecisions } from '../../src/lib/client/api.js';
import strings from '../../src/lib/strings.js';

afterEach(cleanup);

const removed: PatchTripDiffRemoved[] = [
  { row_id: 11, item_id: 'item_a', display_name: 'Removed A', count: 2, is_checked: false },
  { row_id: 12, item_id: 'item_b', display_name: 'Removed B', count: 1, is_checked: false }
];

describe('RegenDiffModal', () => {
  it('does not render when closed', () => {
    render(RegenDiffModal, {
      props: {
        open: false,
        added: [],
        updated: [],
        toBeRemoved: removed,
        onConfirm: vi.fn(),
        onCancel: vi.fn()
      }
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders the three sections with payload display names', () => {
    render(RegenDiffModal, {
      props: {
        open: true,
        added: [{ item_id: 'add_1', display_name: 'Added Name', count: 1 }],
        updated: [
          {
            item_id: 'upd_1',
            display_name: 'Updated Name',
            previous_count: 1,
            new_count: 2,
            count_preserved: false
          }
        ],
        toBeRemoved: removed,
        onConfirm: vi.fn(),
        onCancel: vi.fn()
      }
    });
    expect(screen.getByText(strings.regen.added_heading)).toBeInTheDocument();
    expect(screen.getByText(strings.regen.updated_heading)).toBeInTheDocument();
    expect(screen.getByText(strings.regen.removed_heading)).toBeInTheDocument();
    expect(screen.getByText('Added Name')).toBeInTheDocument();
    expect(screen.getByText('Updated Name')).toBeInTheDocument();
    expect(screen.queryByText('add_1')).not.toBeInTheDocument();
    expect(screen.queryByText('upd_1')).not.toBeInTheDocument();
  });

  it('updated rows show old → new counts, preserved rows show the manual note', () => {
    render(RegenDiffModal, {
      props: {
        open: true,
        added: [],
        updated: [
          {
            item_id: 'upd_changed',
            display_name: 'Changed',
            previous_count: 4,
            new_count: 6,
            count_preserved: false
          },
          {
            item_id: 'upd_preserved',
            display_name: 'Preserved',
            previous_count: 99,
            new_count: 99,
            count_preserved: true
          },
          {
            item_id: 'upd_same',
            display_name: 'Same',
            previous_count: 3,
            new_count: 3,
            count_preserved: false
          }
        ],
        toBeRemoved: [],
        onConfirm: vi.fn(),
        onCancel: vi.fn()
      }
    });
    expect(screen.getByText('4 → 6')).toBeInTheDocument();
    expect(
      screen.getByText(strings.regen.count_preserved_note.replace('{count}', '99'))
    ).toBeInTheDocument();
    expect(screen.getByText('× 3')).toBeInTheDocument();
  });

  it('flags checked removals and shows the summary warning', () => {
    render(RegenDiffModal, {
      props: {
        open: true,
        added: [],
        updated: [],
        toBeRemoved: [
          { row_id: 11, item_id: 'item_a', display_name: 'Removed A', count: 2, is_checked: true },
          { row_id: 12, item_id: 'item_b', display_name: 'Removed B', count: 1, is_checked: true },
          { row_id: 13, item_id: 'item_c', display_name: 'Removed C', count: 1, is_checked: false }
        ],
        onConfirm: vi.fn(),
        onCancel: vi.fn()
      }
    });
    expect(screen.getAllByText(`✓ ${strings.regen.was_checked_tag}`)).toHaveLength(2);
    expect(
      screen.getByText(strings.regen.checked_warning_many.replace('{count}', '2'))
    ).toBeInTheDocument();
  });

  it('uses the singular warning for a single checked removal', () => {
    render(RegenDiffModal, {
      props: {
        open: true,
        added: [],
        updated: [],
        toBeRemoved: [
          { row_id: 11, item_id: 'item_a', display_name: 'Removed A', count: 2, is_checked: true }
        ],
        onConfirm: vi.fn(),
        onCancel: vi.fn()
      }
    });
    expect(screen.getByText(strings.regen.checked_warning_one)).toBeInTheDocument();
  });

  it('all removal checkboxes are checked by default', () => {
    render(RegenDiffModal, {
      props: {
        open: true,
        added: [],
        updated: [],
        toBeRemoved: removed,
        onConfirm: vi.fn(),
        onCancel: vi.fn()
      }
    });
    const groups = screen.getAllByRole('radiogroup');
    expect(groups).toHaveLength(2);
    const selected = screen
      .getAllByRole('radio')
      .filter((r) => r.getAttribute('aria-checked') === 'true')
      .map((r) => r.textContent?.trim());
    expect(selected).toEqual([strings.regen.choice_remove, strings.regen.choice_remove]);
  });

  it('sends each item with its choice: remove, keep or mark packed', async () => {
    const onConfirm = vi.fn();
    render(RegenDiffModal, {
      props: {
        open: true,
        added: [],
        updated: [],
        toBeRemoved: removed,
        onConfirm,
        onCancel: vi.fn()
      }
    });
    const [first, second] = screen.getAllByRole('radiogroup');
    await fireEvent.click(within(first!).getByRole('radio', { name: strings.regen.choice_keep }));
    await fireEvent.click(within(second!).getByRole('radio', { name: strings.regen.choice_pack }));
    await fireEvent.click(screen.getByRole('button', { name: strings.regen.confirm }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    const arg = onConfirm.mock.calls[0]![0] as OrphanDecisions;
    expect(arg.remove).toEqual([]);
    expect(arg.keep.map((r) => r.row_id)).toEqual([11]);
    expect(arg.pack.map((r) => r.row_id)).toEqual([12]);
  });

  it('applies one choice to all items', async () => {
    const onConfirm = vi.fn();
    render(RegenDiffModal, {
      props: { open: true, added: [], updated: [], toBeRemoved: removed, onConfirm, onCancel: vi.fn() }
    });
    const applyAll = screen.getByText(strings.regen.apply_all).parentElement!;
    await fireEvent.click(within(applyAll).getByRole('button', { name: strings.regen.choice_keep }));
    await fireEvent.click(screen.getByRole('button', { name: strings.regen.confirm }));
    const arg = onConfirm.mock.calls[0]![0] as OrphanDecisions;
    expect(arg.keep.map((r) => r.row_id)).toEqual([11, 12]);
  });

  it('cancel button calls onCancel', async () => {
    const onCancel = vi.fn();
    render(RegenDiffModal, {
      props: {
        open: true,
        added: [],
        updated: [],
        toBeRemoved: removed,
        onConfirm: vi.fn(),
        onCancel
      }
    });
    await fireEvent.click(screen.getByRole('button', { name: strings.regen.cancel }));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
