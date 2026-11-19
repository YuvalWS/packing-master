// Holiday ids for the {holiday} condition (DESIGN.md 14.1). Kept free of @hebcal/core so
// schemas can import it cheaply.
export const HOLIDAY_IDS = [
  'rosh_hashana',
  'yom_kippur',
  'sukkot',
  'shmini_atzeret',
  'chanukah',
  'tu_bishvat',
  'purim',
  'pesach',
  'lag_baomer',
  'shavuot',
  'tisha_bav',
  'yom_hazikaron',
  'yom_haatzmaut',
  'yom_yerushalayim'
] as const;
export type HolidayId = (typeof HOLIDAY_IDS)[number];
