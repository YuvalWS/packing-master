export type ViewMode = 'category' | 'bag';

export interface TripViewPrefs {
  mode: ViewMode;
  checkedToBottom: boolean;
}

const DEFAULTS: TripViewPrefs = {
  mode: 'category',
  checkedToBottom: false
};

function key(tripId: number): string {
  return `pm:trip:${tripId}:view`;
}

export function loadPrefs(tripId: number): TripViewPrefs {
  if (typeof localStorage === 'undefined') return DEFAULTS;
  try {
    const raw = localStorage.getItem(key(tripId));
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<TripViewPrefs>;
    return {
      mode: parsed.mode === 'bag' ? 'bag' : 'category',
      checkedToBottom: Boolean(parsed.checkedToBottom)
    };
  } catch {
    return DEFAULTS;
  }
}

export function savePrefs(tripId: number, prefs: TripViewPrefs): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(key(tripId), JSON.stringify(prefs));
  } catch {
    // ignore quota / serialization failures
  }
}
