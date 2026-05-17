import { shabbatInfo } from './shabbat.js';

export interface DerivedTrip {
  days: number;
  weekdays: number;
  weekends: number;
  hasShabbat: boolean;
  shabbatCount: number;
  longTrip: boolean;
  shortTrip: boolean;
  derivedParamIds: string[];
}

export const LONG_TRIP_DAYS = 14;
export const SHORT_TRIP_DAYS = 2;

function parseISODate(s: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) throw new Error(`invalid ISO date: ${s}`);
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

function dayCounts(startISO: string, endISO: string): {
  days: number;
  weekdays: number;
  weekends: number;
} {
  const start = parseISODate(startISO);
  const end = parseISODate(endISO);
  if (end < start) throw new Error(`derive: end (${endISO}) before start (${startISO})`);

  let days = 0;
  let weekdays = 0;
  let weekends = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const dow = cur.getUTCDay(); // 0 Sun ... 6 Sat
    days++;
    // Weekend convention: Friday (5) + Saturday (6). Sun-Thu are weekdays.
    if (dow === 5 || dow === 6) weekends++;
    else weekdays++;
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return { days, weekdays, weekends };
}

export function derive(startISO: string, endISO: string): DerivedTrip {
  const { days, weekdays, weekends } = dayCounts(startISO, endISO);
  const { hasShabbat, shabbatCount } = shabbatInfo(startISO, endISO);
  const longTrip = days >= LONG_TRIP_DAYS;
  const shortTrip = days <= SHORT_TRIP_DAYS;

  const derivedParamIds: string[] = [];
  if (hasShabbat) derivedParamIds.push('derived_has_shabbat');
  if (longTrip) derivedParamIds.push('derived_long_trip');
  if (shortTrip) derivedParamIds.push('derived_short_trip');

  return {
    days,
    weekdays,
    weekends,
    hasShabbat,
    shabbatCount,
    longTrip,
    shortTrip,
    derivedParamIds
  };
}
