import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/svelte';
import ParamChipList from '../../src/lib/components/ParamChipList.svelte';
import type { Parameter } from '../../src/lib/client/api.js';
import strings from '../../src/lib/strings.js';

afterEach(cleanup);

function params(count: number): Parameter[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `param_${i}`,
    display_name: `Param ${i}`,
    category: 'environment',
    is_singleton: false,
    is_derived: false,
    sort_order: i
  }));
}

describe('ParamChipList', () => {
  it('renders nothing for an empty list', () => {
    const { container } = render(ParamChipList, { props: { parameters: [] } });
    expect(container.querySelector('ul')).toBeNull();
  });

  it('shows all chips without an overflow button when under the limit', () => {
    render(ParamChipList, { props: { parameters: params(3), maxShown: 3 } });
    expect(screen.getByText('Param 0')).toBeInTheDocument();
    expect(screen.getByText('Param 2')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('truncates to maxShown with a +N button', () => {
    render(ParamChipList, { props: { parameters: params(5), maxShown: 3 } });
    expect(screen.getByText('Param 2')).toBeInTheDocument();
    expect(screen.queryByText('Param 3')).not.toBeInTheDocument();
    expect(
      screen.getByText(strings.trips_list.and_more.replace('{count}', '2'))
    ).toBeInTheDocument();
  });

  it('expands on tap and collapses on a second tap', async () => {
    render(ParamChipList, { props: { parameters: params(5), maxShown: 3 } });
    const toggle = screen.getByRole('button');
    await fireEvent.click(toggle);
    expect(screen.getByText('Param 4')).toBeInTheDocument();
    expect(screen.getByText(strings.trips_list.show_less)).toBeInTheDocument();

    await fireEvent.click(toggle);
    expect(screen.queryByText('Param 4')).not.toBeInTheDocument();
    expect(
      screen.getByText(strings.trips_list.and_more.replace('{count}', '2'))
    ).toBeInTheDocument();
  });
});
