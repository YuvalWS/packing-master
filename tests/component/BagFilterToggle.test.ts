import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/svelte';
import BagFilterToggle from '../../src/lib/components/BagFilterToggle.svelte';
import strings from '../../src/lib/strings.js';

afterEach(cleanup);

describe('BagFilterToggle', () => {
  it('marks the active mode with aria-selected=true', () => {
    render(BagFilterToggle, { props: { mode: 'category', onChange: vi.fn() } });
    expect(
      screen.getByRole('tab', { name: strings.view.by_category })
    ).toHaveAttribute('aria-selected', 'true');
    expect(
      screen.getByRole('tab', { name: strings.view.by_bag })
    ).toHaveAttribute('aria-selected', 'false');
  });

  it('calls onChange with the new mode when an inactive tab is clicked', async () => {
    const onChange = vi.fn();
    render(BagFilterToggle, { props: { mode: 'category', onChange } });
    await fireEvent.click(screen.getByRole('tab', { name: strings.view.by_bag }));
    expect(onChange).toHaveBeenCalledWith('bag');
  });

  it('clicking the already-active mode still emits (idempotent)', async () => {
    const onChange = vi.fn();
    render(BagFilterToggle, { props: { mode: 'category', onChange } });
    await fireEvent.click(screen.getByRole('tab', { name: strings.view.by_category }));
    expect(onChange).toHaveBeenCalledWith('category');
  });
});
