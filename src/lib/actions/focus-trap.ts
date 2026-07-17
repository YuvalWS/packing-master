/* Minimal focus trap for modal surfaces. Hand-rolled instead of the
   focus-trap package: ~40 lines covers focus-on-open, Tab cycling, and
   focus restore, without adding a dependency (and a Docker image
   rebuild) for configuration surface this app never uses. */

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
  'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function focusTrap(node: HTMLElement) {
  const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;

  function focusables(): HTMLElement[] {
    return [...node.querySelectorAll<HTMLElement>(FOCUSABLE)];
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key !== 'Tab') return;
    const els = focusables();
    if (els.length === 0) {
      e.preventDefault();
      return;
    }
    const first = els[0]!;
    const last = els[els.length - 1]!;
    const active = document.activeElement;
    if (e.shiftKey && (active === first || !node.contains(active))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (active === last || !node.contains(active))) {
      e.preventDefault();
      first.focus();
    }
  }

  const initial = focusables()[0];
  if (initial) initial.focus();
  else {
    node.tabIndex = -1;
    node.focus();
  }
  node.addEventListener('keydown', onKeydown);

  return {
    destroy() {
      node.removeEventListener('keydown', onKeydown);
      opener?.focus();
    }
  };
}
