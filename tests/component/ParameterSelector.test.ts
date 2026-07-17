import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/svelte';
import ParameterSelector from '../../src/lib/components/ParameterSelector.svelte';
import type { Parameter } from '../../src/lib/client/api.js';
import strings from '../../src/lib/strings.js';

afterEach(cleanup);

function p(
  id: string,
  display_name: string,
  category: Parameter['category'],
  sort_order = 0,
  is_singleton = false
): Parameter {
  return { id, display_name, category, is_singleton, is_derived: false, sort_order };
}

const fixture: Parameter[] = [
  p('accom_a', 'Hotel', 'accommodation', 10, true),
  p('accom_b', 'Outdoor', 'accommodation', 20, true),
  p('env_cold', 'Cold', 'environment', 10),
  p('env_hot', 'Hot', 'environment', 20),
  p('plan_hike', 'Hike', 'day_plans', 10),
  p('plan_swim', 'Swim', 'day_plans', 20),
  { id: 'derived_x', display_name: 'D', category: 'derived', is_singleton: false, is_derived: true, sort_order: 0 }
];

describe('ParameterSelector', () => {
  it('renders accommodation as radios and ignores derived parameters', () => {
    const onChange = vi.fn();
    render(ParameterSelector, {
      props: { parameters: fixture, selected: [], onChange }
    });
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(2);
    expect(screen.queryByText('D')).not.toBeInTheDocument();
  });

  it('selecting an accommodation replaces any previous accommodation', async () => {
    const onChange = vi.fn();
    render(ParameterSelector, {
      props: { parameters: fixture, selected: ['accom_a', 'env_cold'], onChange }
    });
    await fireEvent.click(screen.getByLabelText('Outdoor'));
    expect(onChange).toHaveBeenCalledWith(['env_cold', 'accom_b']);
  });

  it('environment chips toggle independently and stack', async () => {
    const onChange = vi.fn();
    render(ParameterSelector, {
      props: { parameters: fixture, selected: ['accom_a'], onChange }
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Cold' }));
    expect(onChange).toHaveBeenLastCalledWith(['accom_a', 'env_cold']);
  });

  it('clicking an active chip removes it', async () => {
    const onChange = vi.fn();
    render(ParameterSelector, {
      props: { parameters: fixture, selected: ['accom_a', 'plan_hike'], onChange }
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Hike' }));
    expect(onChange).toHaveBeenLastCalledWith(['accom_a']);
  });

  it('shows aria-pressed=true on selected chips', () => {
    render(ParameterSelector, {
      props: { parameters: fixture, selected: ['plan_swim'], onChange: vi.fn() }
    });
    const swim = screen.getByRole('button', { name: 'Swim' });
    expect(swim).toHaveAttribute('aria-pressed', 'true');
    const hike = screen.getByRole('button', { name: 'Hike' });
    expect(hike).toHaveAttribute('aria-pressed', 'false');
  });

  it('renders active derived params as a read-only section', () => {
    render(ParameterSelector, {
      props: {
        parameters: fixture,
        selected: [],
        derivedActive: ['derived_x'],
        onChange: vi.fn()
      }
    });
    expect(screen.getByText(strings.parameter_category.derived)).toBeInTheDocument();
    expect(screen.getByText('D')).toBeInTheDocument();
    expect(screen.getByText(strings.new_trip.derived_hint)).toBeInTheDocument();
    // Not a toggle: no button/checkbox role for the derived chip.
    expect(screen.queryByRole('button', { name: 'D' })).not.toBeInTheDocument();
  });

  it('hides the derived section when nothing is detected', () => {
    render(ParameterSelector, {
      props: { parameters: fixture, selected: [], derivedActive: [], onChange: vi.fn() }
    });
    expect(screen.queryByText(strings.parameter_category.derived)).not.toBeInTheDocument();
  });
});
