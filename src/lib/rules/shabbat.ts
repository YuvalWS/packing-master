import { HDate, HebrewCalendar, flags, type Event } from '@hebcal/core';
import type { HolidayId } from './holidays.js';

export type { HolidayId } from './holidays.js';

// Shabbat, Yom Tov and holidays for a trip's dates (DESIGN.md 14.1), Israel schedule.

// hebcal event basename -> our id. Unlisted events (minor fasts, modern days of note,
// Purim Katan...) are ignored.
const BY_BASENAME: Record<string, HolidayId> = {
  'Rosh Hashana': 'rosh_hashana',
  'Yom Kippur': 'yom_kippur',
  Sukkot: 'sukkot',
  'Shmini Atzeret': 'shmini_atzeret',
  'Simchat Torah': 'shmini_atzeret',
  Chanukah: 'chanukah',
  'Tu BiShvat': 'tu_bishvat',
  Purim: 'purim',
  'Shushan Purim': 'purim',
  Pesach: 'pesach',
  'Lag BaOmer': 'lag_baomer',
  Shavuot: 'shavuot',
  "Tish'a B'Av": 'tisha_bav',
  'Yom HaZikaron': 'yom_hazikaron',
  "Yom HaAtzma'ut": 'yom_haatzmaut',
  'Yom Yerushalayim': 'yom_yerushalayim'
};

export interface ShabbatInfo {
  /** The trip includes a Shabbat or a Yom Tov day ("holy day"). */
  hasShabbat: boolean;
  /** Holy days: dates that are Shabbat or Yom Tov, each counted once. */
  shabbatCount: number;
  yomTovCount: number;
  /** Holidays the trip overlaps, in calendar order. */
  holidays: HolidayId[];
  /** Hebrew dates of the first and last day, in Hebrew letters. */
  hebrewStart: string;
  hebrewEnd: string;
}

function parseISODate(s: string): Date {
  // Calendar date (YYYY-MM-DD) interpreted as UTC midnight,
  // so iteration in UTC won't drift with the host TZ.
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) throw new Error(`invalid ISO date: ${s}`);
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

// hebcal works in local calendar dates; build one from the UTC fields.
const localDate = (d: Date) => new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
const dayKey = (hd: HDate) => hd.abs();

export function shabbatInfo(startISO: string, endISO: string): ShabbatInfo {
  const start = parseISODate(startISO);
  const end = parseISODate(endISO);
  if (end < start) {
    throw new Error(`shabbatInfo: end (${endISO}) before start (${startISO})`);
  }
  const first = new HDate(localDate(start));
  const last = new HDate(localDate(end));

  const events: Event[] = HebrewCalendar.calendar({
    start: first,
    end: last,
    il: true,
    noRoshChodesh: true,
    noSpecialShabbat: true,
    noMinorFast: true,
    omer: false
  });

  const holy = new Set<number>();
  const yomTov = new Set<number>();
  const holidays: HolidayId[] = [];
  for (let d = first.abs(); d <= last.abs(); d++) {
    if (new HDate(d).getDay() === 6) holy.add(d);
  }
  for (const ev of events) {
    const id = BY_BASENAME[ev.basename()];
    const f = ev.getFlags();
    const day = dayKey(ev.getDate());
    if (f & flags.CHAG && !(f & flags.EREV)) {
      holy.add(day);
      yomTov.add(day);
    }
    if (!id) continue;
    // A holiday that starts in the evening counts only if the trip includes that night.
    if (f & flags.EREV && day === last.abs()) continue;
    if (!holidays.includes(id)) holidays.push(id);
  }

  return {
    hasShabbat: holy.size > 0,
    shabbatCount: holy.size,
    yomTovCount: yomTov.size,
    holidays,
    hebrewStart: first.renderGematriya(true),
    hebrewEnd: last.renderGematriya(true)
  };
}
