import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import Modal from '../../src/lib/components/Modal.svelte';

afterEach(cleanup);

const body = createRawSnippet(() => ({
  render: () => '<div><button type="button">inner action</button></div>'
}));

describe('Modal focus management', () => {
  it('moves focus into the dialog on open and restores it on close', async () => {
    const outside = document.createElement('button');
    outside.textContent = 'opener';
    document.body.appendChild(outside);
    outside.focus();
    expect(document.activeElement).toBe(outside);

    const { rerender } = render(Modal, {
      props: { open: false, title: 'Dialog', onClose: vi.fn(), children: body }
    });
    await rerender({ open: true });

    const dialog = screen.getByRole('dialog');
    expect(dialog.contains(document.activeElement)).toBe(true);

    await rerender({ open: false });
    expect(document.activeElement).toBe(outside);
    outside.remove();
  });

  it('Tab cycles focus within the dialog', async () => {
    render(Modal, {
      props: { open: true, title: 'Dialog', onClose: vi.fn(), children: body }
    });
    const dialog = screen.getByRole('dialog');
    const buttons = [...dialog.querySelectorAll('button')];
    const last = buttons[buttons.length - 1]!;
    last.focus();

    await fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).toBe(buttons[0]);
  });
});
