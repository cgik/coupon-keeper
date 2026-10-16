/**
 * A calendar day written as "YYYY-MM-DD", with no time or time zone.
 *
 * Coupon expiry is a store's calendar day, not an instant. Storing it as a
 * timestamp makes it land on the wrong day for some users, so every date in
 * the domain is an IsoDate. The only way to obtain one is through the
 * constructors below, which guarantees the string is a real date.
 */
export type IsoDate = string & { readonly __brand: "IsoDate" };

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function parseIsoDate(text: string): IsoDate | null {
  const match = ISO_DATE_PATTERN.exec(text);
  if (match === null) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  // Date.UTC silently rolls invalid days over ("2026-02-30" -> March 2),
  // so round-trip the parts to reject anything that isn't a real date.
  const roundTrip = new Date(Date.UTC(year, month - 1, day));
  const isRealDate =
    roundTrip.getUTCFullYear() === year &&
    roundTrip.getUTCMonth() === month - 1 &&
    roundTrip.getUTCDate() === day;

  return isRealDate ? (text as IsoDate) : null;
}

/** The calendar day `instant` falls on in the local time zone of the machine. */
export function toLocalIsoDate(instant: Date): IsoDate {
  return formatIsoDate(instant.getFullYear(), instant.getMonth() + 1, instant.getDate());
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((toUtcMidnight(to) - toUtcMidnight(from)) / MS_PER_DAY);
}

function toUtcMidnight(date: IsoDate): number {
  const [year, month, day] = date.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

/** A month on the calendar; `month` runs 1–12. */
export interface CalendarMonth {
  readonly year: number;
  readonly month: number;
}

export function monthOf(date: IsoDate): CalendarMonth {
  const [year, month] = date.split("-").map(Number);
  return { year, month };
}

/** The month `delta` months after `from`; negative goes back. */
export function shiftMonth(from: CalendarMonth, delta: number): CalendarMonth {
  const monthIndex = from.year * 12 + (from.month - 1) + delta;
  return { year: Math.floor(monthIndex / 12), month: (monthIndex % 12 + 12) % 12 + 1 };
}

/**
 * The days of `calendarMonth` laid out in Sunday-first weeks of seven.
 * Cells before the 1st and after the last day are null.
 */
export function monthWeeks({ year, month }: CalendarMonth): (IsoDate | null)[][] {
  const leadingBlanks = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const dayCount = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const cells: (IsoDate | null)[] = Array.from({ length: leadingBlanks }, () => null);
  for (let day = 1; day <= dayCount; day++) cells.push(formatIsoDate(year, month, day));
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (IsoDate | null)[][] = [];
  for (let start = 0; start < cells.length; start += 7) weeks.push(cells.slice(start, start + 7));
  return weeks;
}

function formatIsoDate(year: number, month: number, day: number): IsoDate {
  const pad = (value: number, width: number) => String(value).padStart(width, "0");
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}` as IsoDate;
}
