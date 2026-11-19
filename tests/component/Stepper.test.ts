import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/svelte';
import Stepper from '../../src/lib/components/Stepper.svelte';
import strings from '../../src/lib/strings.js';

afterEach(cleanup);

describe('Stepper', () => {
  it('increments via the plus button', async () => {
    const onChange = vi.fn();
    render(Stepper, { props: { value: 3, onChange } });
    await fireEvent.click(screen.getByRole('button', { name: strings.a11y_row.increment }));
    expect(onChange).toHaveBeenCalledWith(4);
  });

  it('decrements via the minus button', async () => {
    const onChange = vi.fn();
    render(Stepper, { props: { value: 3, onChange } });
    await fireEvent.click(screen.getByRole('button', { name: strings.a11y_row.decrement }));
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it('disables the minus button at the floor', () => {
    render(Stepper, { props: { value: 1, min: 1, onChange: vi.fn() } });
    expect(screen.getByRole('button', { name: strings.a11y_row.decrement })).toBeDisabled();
  });

  it('disables the plus button at the ceiling', () => {
    render(Stepper, { props: { value: 5, max: 5, onChange: vi.fn() } });
    expect(screen.getByRole('button', { name: strings.a11y_row.increment })).toBeDisabled();
  });

  it('minus at the floor calls onBelowMin instead of being disabled', async () => {
    const onChange = vi.fn();
    const onBelowMin = vi.fn();
    render(Stepper, { props: { value: 1, min: 1, onChange, onBelowMin } });
    await fireEvent.click(screen.getByRole('button', { name: strings.a11y_row.decrement }));
    expect(onBelowMin).toHaveBeenCalledOnce();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('disables both buttons when disabled prop is true', () => {
    render(Stepper, { props: { value: 3, disabled: true, onChange: vi.fn() } });
    expect(screen.getByRole('button', { name: strings.a11y_row.increment })).toBeDisabled();
    expect(screen.getByRole('button', { name: strings.a11y_row.decrement })).toBeDisabled();
  });
});
