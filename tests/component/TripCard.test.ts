import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/svelte';
import TripCard from '../../src/lib/components/TripCard.svelte';
import type {
  TripRowWithItemCount,
  Parameter
} from '../../src/lib/client/api.js';
import strings from '../../src/lib/strings.js';

afterEach(cleanup);

function param(id: string, name: string, category: Parameter['category']): Parameter {
  return {
    id,
    display_name: name,
    category,
    is_singleton: category === 'accommodation',
    is_derived: false,
    sort_order: 0
  };
}

function makeTrip(overrides: Partial<TripRowWithItemCount> = {}): TripRowWithItemCount {
  return {
    id: 1,
    name: 'Test trip',
    template_id: null,
    start_date: '2025-01-10',
    end_date: '2025-01-15',
    destination: null,
    context: { parameters: ['accom_a', 'env_cold', 'plan_hiking', 'plan_swimming'] },
    travelers: null,
    created_at: new Date(),
    updated_at: new Date(),
    item_count: 12,
    checked_count: 0,
    ...overrides
  };
}

function paramsMap(): Map<string, Parameter> {
  return new Map([
    ['accom_a', param('accom_a', 'Hotel', 'accommodation')],
    ['env_cold', param('env_cold', 'Cold', 'environment')],
    ['plan_hiking', param('plan_hiking', 'Hiking', 'day_plans')],
    ['plan_swimming', param('plan_swimming', 'Swimming', 'day_plans')]
  ]);
}

describe('TripCard', () => {
  it('renders the trip name as title and links to its detail page', () => {
    render(TripCard, { props: { trip: makeTrip(), parametersById: paramsMap() } });
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/trips/1');
    expect(screen.getByRole('heading')).toHaveTextContent('Test trip');
  });

  it('falls back to "{days} days at {accommodation}" when name is empty', () => {
    render(TripCard, {
      props: {
        trip: makeTrip({ name: '', start_date: '2025-01-10', end_date: '2025-01-15' }),
        parametersById: paramsMap()
      }
    });
    const expected = strings.trips_list.no_name_fallback
      .replace('{days}', '6')
      .replace('{accommodation}', 'Hotel');
    expect(screen.getByRole('heading')).toHaveTextContent(expected);
  });

  it('falls back to the plain days title when no accommodation param is set', () => {
    render(TripCard, {
      props: {
        trip: makeTrip({ name: '', context: { parameters: ['env_cold'] } }),
        parametersById: paramsMap()
      }
    });
    const expected = strings.trips_list.no_name_fallback_no_accommodation.replace('{days}', '6');
    expect(screen.getByRole('heading')).toHaveTextContent(expected);
  });

  it('shows the day count in the dates line', () => {
    const { container } = render(TripCard, {
      props: { trip: makeTrip(), parametersById: paramsMap() }
    });
    const dates = container.querySelector('.dates')?.textContent?.replace(/\s+/g, ' ');
    expect(dates).toContain(`6 ${strings.common.day_many}`);
  });

  it('shows a completed badge for fully-checked past trips', () => {
    render(TripCard, {
      props: {
        trip: makeTrip({ item_count: 5, checked_count: 5 }),
        parametersById: paramsMap(),
        past: true
      }
    });
    expect(screen.getByText(strings.trips_list.completed)).toBeInTheDocument();
    expect(
      screen.queryByText(strings.trips_list.items_count_many.replace('{count}', '5'))
    ).not.toBeInTheDocument();
  });

  it('past but incomplete trips keep the item count', () => {
    render(TripCard, {
      props: {
        trip: makeTrip({ item_count: 5, checked_count: 3 }),
        parametersById: paramsMap(),
        past: true
      }
    });
    expect(screen.queryByText(strings.trips_list.completed)).not.toBeInTheDocument();
    expect(
      screen.getByText(strings.trips_list.items_count_many.replace('{count}', '5'))
    ).toBeInTheDocument();
  });

  it('renders item count using the singular form when count is 1', () => {
    render(TripCard, {
      props: { trip: makeTrip({ item_count: 1 }), parametersById: paramsMap() }
    });
    expect(screen.getByText(strings.trips_list.items_count_one)).toBeInTheDocument();
  });

  it('renders item count using the plural form with substitution', () => {
    render(TripCard, {
      props: { trip: makeTrip({ item_count: 7 }), parametersById: paramsMap() }
    });
    expect(
      screen.getByText(strings.trips_list.items_count_many.replace('{count}', '7'))
    ).toBeInTheDocument();
  });

  it('shows only the first N chips and an overflow indicator', () => {
    render(TripCard, {
      props: { trip: makeTrip(), parametersById: paramsMap(), maxChipsShown: 2 }
    });
    expect(screen.getByText('Hotel')).toBeInTheDocument();
    expect(screen.getByText('Cold')).toBeInTheDocument();
    expect(screen.queryByText('Hiking')).not.toBeInTheDocument();
    expect(screen.getByText('+2')).toBeInTheDocument();
  });

  it('expands all chips when the overflow button is clicked', async () => {
    render(TripCard, {
      props: { trip: makeTrip(), parametersById: paramsMap(), maxChipsShown: 2 }
    });
    await fireEvent.click(screen.getByText('+2'));
    expect(screen.getByText('Hiking')).toBeInTheDocument();
    expect(screen.getByText('Swimming')).toBeInTheDocument();
    expect(screen.queryByText('+2')).not.toBeInTheDocument();
  });
});
