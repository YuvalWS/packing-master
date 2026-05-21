import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/svelte';
import RegenDiffModal from '../../src/lib/components/RegenDiffModal.svelte';
import type { PatchTripDiffRemoved } from '../../src/lib/client/api.js';
import strings from '../../src/lib/strings.js';

afterEach(cleanup);

const removed: PatchTripDiffRemoved[] = [
  { row_id: 11, item_id: 'item_a', display_name: 'Removed A', count: 2 },
  { row_id: 12, item_id: 'item_b', display_name: 'Removed B', count: 1 }
];

describe('RegenDiffModal', () => {
  it('does not render when closed', () => {
    render(RegenDiffModal, {
      props: {
        open: false,
        added: [],
        updated: [],
        toBeRemoved: removed,
        displayNameById: new Map(),
        onConfirm: vi.fn(),
        onCancel: vi.fn()
      }
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders the three sections when open and all have content', () => {
    render(RegenDiffModal, {
      props: {
        open: true,
        added: [{ itemId: 'add_1', count: 1 }],
        updated: [{ itemId: 'upd_1', newCount: 2, countPreserved: false }],
        toBeRemoved: removed,
        displayNameById: new Map([
          ['add_1', 'Added Name'],
          ['upd_1', 'Updated Name']
        ]),
        onConfirm: vi.fn(),
        onCancel: vi.fn()
      }
    });
    expect(screen.getByText(strings.regen.added_heading)).toBeInTheDocument();
    expect(screen.getByText(strings.regen.updated_heading)).toBeInTheDocument();
    expect(screen.getByText(strings.regen.removed_heading)).toBeInTheDocument();
    expect(screen.getByText('Added Name')).toBeInTheDocument();
    expect(screen.getByText('Updated Name')).toBeInTheDocument();
  });

  it('all removal checkboxes are checked by default', () => {
    render(RegenDiffModal, {
      props: {
        open: true,
        added: [],
        updated: [],
        toBeRemoved: removed,
        displayNameById: new Map(),
        onConfirm: vi.fn(),
        onCancel: vi.fn()
      }
    });
    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    expect(checkboxes).toHaveLength(2);
    expect(checkboxes.every((c) => c.checked)).toBe(true);
  });

  it('unchecking a removal omits it from the onConfirm payload', async () => {
    const onConfirm = vi.fn();
    render(RegenDiffModal, {
      props: {
        open: true,
        added: [],
        updated: [],
        toBeRemoved: removed,
        displayNameById: new Map(),
        onConfirm,
        onCancel: vi.fn()
      }
    });
    const [first] = screen.getAllByRole('checkbox');
    await fireEvent.click(first!);
    await fireEvent.click(screen.getByRole('button', { name: strings.regen.confirm }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    const arg = onConfirm.mock.calls[0]![0] as PatchTripDiffRemoved[];
    expect(arg).toHaveLength(1);
    expect(arg[0]!.row_id).toBe(12);
  });

  it('cancel button calls onCancel', async () => {
    const onCancel = vi.fn();
    render(RegenDiffModal, {
      props: {
        open: true,
        added: [],
        updated: [],
        toBeRemoved: removed,
        displayNameById: new Map(),
        onConfirm: vi.fn(),
        onCancel
      }
    });
    await fireEvent.click(screen.getByRole('button', { name: strings.regen.cancel }));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
