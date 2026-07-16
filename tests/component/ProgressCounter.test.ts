import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/svelte';
import ProgressCounter from '../../src/lib/components/ProgressCounter.svelte';
import strings from '../../src/lib/strings.js';

afterEach(cleanup);

describe('ProgressCounter', () => {
  it('renders the required progress and optional suffix', () => {
    render(ProgressCounter, {
      props: { checkedRequired: 3, totalRequired: 10, uncheckedOptional: 2 }
    });
    expect(screen.getByText('3/10')).toBeInTheDocument();
    expect(
      screen.getByText(strings.packing_list.optional_suffix.replace('{count}', '2'))
    ).toBeInTheDocument();
  });

  it('is a static element without onCycle', () => {
    render(ProgressCounter, {
      props: { checkedRequired: 0, totalRequired: 5, uncheckedOptional: 0 }
    });
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('becomes a button with onCycle and fires it on click', async () => {
    const onCycle = vi.fn();
    render(ProgressCounter, {
      props: { checkedRequired: 0, totalRequired: 5, uncheckedOptional: 0, onCycle }
    });
    await fireEvent.click(screen.getByRole('button'));
    expect(onCycle).toHaveBeenCalledOnce();
  });

  it('describes the active filter mode in the accessible name and caption', () => {
    render(ProgressCounter, {
      props: {
        checkedRequired: 0,
        totalRequired: 5,
        uncheckedOptional: 1,
        filterMode: 'required',
        onCycle: vi.fn()
      }
    });
    const button = screen.getByRole('button', {
      name: `${strings.packing_list.filter_hint}: ${strings.packing_list.filter_required}`
    });
    expect(button).toBeInTheDocument();
    expect(screen.getByText(strings.packing_list.filter_required)).toBeInTheDocument();
  });
});
