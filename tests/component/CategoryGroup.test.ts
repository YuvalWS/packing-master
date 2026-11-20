import { describe, it, expect, afterEach, vi } from 'vitest';
import { createRawSnippet } from 'svelte';
import { render, screen, cleanup, fireEvent } from '@testing-library/svelte';
import CategoryGroup from '../../src/lib/components/CategoryGroup.svelte';
import strings from '../../src/lib/strings.js';

afterEach(cleanup);

const children = createRawSnippet(() => ({ render: () => '<div>row</div>' }));

describe('CategoryGroup', () => {
  it('shows a plain count without done', () => {
    render(CategoryGroup, { props: { title: 'Bath', count: 4, children } });
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('shows done/total and a check-all button that fires onCheckAll', async () => {
    const onCheckAll = vi.fn();
    render(CategoryGroup, { props: { title: 'Bath', count: 7, done: 3, onCheckAll, children } });
    expect(screen.getByText('3/7')).toBeInTheDocument();
    const button = screen.getByRole('button', {
      name: strings.packing_list.check_group.replace('{name}', 'Bath')
    });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    await fireEvent.click(button);
    expect(onCheckAll).toHaveBeenCalledOnce();
  });

  it('offers to uncheck when every row is checked', () => {
    render(CategoryGroup, {
      props: { title: 'Bath', count: 2, done: 2, onCheckAll: vi.fn(), children }
    });
    expect(
      screen.getByRole('button', {
        name: strings.packing_list.uncheck_group.replace('{name}', 'Bath')
      })
    ).toHaveAttribute('aria-pressed', 'true');
  });
});
