/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { loadPrefs, savePrefs } from '../../src/lib/client/view-prefs.js';

beforeEach(() => {
  localStorage.clear();
});

describe('view-prefs', () => {
  it('returns defaults when nothing is stored', () => {
    expect(loadPrefs(1)).toEqual({ mode: 'category', checkedToBottom: false });
  });

  it('round-trips through localStorage', () => {
    savePrefs(7, { mode: 'bag', checkedToBottom: true });
    expect(loadPrefs(7)).toEqual({ mode: 'bag', checkedToBottom: true });
  });

  it('isolates per trip id', () => {
    savePrefs(7, { mode: 'bag', checkedToBottom: true });
    savePrefs(8, { mode: 'category', checkedToBottom: false });
    expect(loadPrefs(7).mode).toBe('bag');
    expect(loadPrefs(8).mode).toBe('category');
  });

  it('falls back to defaults on malformed JSON', () => {
    localStorage.setItem('pm:trip:7:view', 'not json{');
    expect(loadPrefs(7)).toEqual({ mode: 'category', checkedToBottom: false });
  });

  it('coerces invalid mode values to category', () => {
    localStorage.setItem('pm:trip:7:view', JSON.stringify({ mode: 'something_else', checkedToBottom: 1 }));
    expect(loadPrefs(7)).toEqual({ mode: 'category', checkedToBottom: true });
  });
});
