import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/svelte';
import OwnerFilter from '../../src/lib/components/OwnerFilter.svelte';
import strings from '../../src/lib/strings.js';

afterEach(cleanup);

const owners = [
  { id: 'dad', name: 'Dad', done: 12, total: 40, hidden: false },
  { id: '', name: strings.owners.shared, done: 3, total: 30, hidden: true }
];

describe('OwnerFilter', () => {
  it('shows each owner with done/total and whether it is shown', () => {
    render(OwnerFilter, { props: { owners, onToggle: vi.fn() } });
    expect(screen.getByText('12/40')).toBeInTheDocument();
    expect(screen.getByText('3/30')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: strings.owners.hide.replace('{name}', 'Dad') })
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getByRole('button', {
        name: strings.owners.show.replace('{name}', strings.owners.shared)
      })
    ).toHaveAttribute('aria-pressed', 'false');
  });

  it('reports the owner id on tap', async () => {
    const onToggle = vi.fn();
    render(OwnerFilter, { props: { owners, onToggle } });
    await fireEvent.click(
      screen.getByRole('button', {
        name: strings.owners.show.replace('{name}', strings.owners.shared)
      })
    );
    expect(onToggle).toHaveBeenCalledWith('');
  });
});
