export type ViewMode = 'category' | 'bag';

export interface TripViewPrefs {
  mode: ViewMode;
  checkedToBottom: boolean;
  /** Owners whose rows are hidden on the trip screen: person ids, '' for shared (DESIGN.md 15.2). */
  hiddenOwners: string[];
}

const DEFAULTS: TripViewPrefs = {
  mode: 'category',
  checkedToBottom: false,
  hiddenOwners: []
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
      checkedToBottom: Boolean(parsed.checkedToBottom),
      hiddenOwners: Array.isArray(parsed.hiddenOwners)
        ? parsed.hiddenOwners.filter((o): o is string => typeof o === 'string')
        : []
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
