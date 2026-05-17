import { HDate } from '@hebcal/core';

export interface ShabbatInfo {
  hasShabbat: boolean;
  shabbatCount: number;
}

function parseISODate(s: string): Date {
  // Calendar date (YYYY-MM-DD) interpreted as UTC midnight,
  // so iteration in UTC won't drift with the host TZ.
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) throw new Error(`invalid ISO date: ${s}`);
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

export function shabbatInfo(startISO: string, endISO: string): ShabbatInfo {
  const start = parseISODate(startISO);
  const end = parseISODate(endISO);
  if (end < start) {
    throw new Error(`shabbatInfo: end (${endISO}) before start (${startISO})`);
  }

  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    // HDate.getDay(): 0=Sun ... 6=Shabbat (matches JS Date.getUTCDay)
    if (new HDate(cur).getDay() === 6) count++;
    cur.setUTCDate(cur.getUTCDate() + 1);
  }

  return { hasShabbat: count > 0, shabbatCount: count };
}
