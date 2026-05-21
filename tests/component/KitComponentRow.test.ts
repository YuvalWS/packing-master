import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/svelte';
import KitComponentRow from '../../src/lib/components/KitComponentRow.svelte';

afterEach(cleanup);

describe('KitComponentRow', () => {
  it('shows aria-checked=true when isChecked', () => {
    render(KitComponentRow, {
      props: { componentId: 'k1', displayName: 'Component A', isChecked: true, onToggle: vi.fn() }
    });
    expect(screen.getByRole('checkbox')).toHaveAttribute('aria-checked', 'true');
  });

  it('invokes onToggle when clicked', async () => {
    const onToggle = vi.fn();
    render(KitComponentRow, {
      props: { componentId: 'k1', displayName: 'Component A', isChecked: false, onToggle }
    });
    await fireEvent.click(screen.getByRole('checkbox'));
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it('renders the displayName', () => {
    render(KitComponentRow, {
      props: { componentId: 'k1', displayName: 'My Component', isChecked: false, onToggle: vi.fn() }
    });
    expect(screen.getByText('My Component')).toBeInTheDocument();
  });
});
