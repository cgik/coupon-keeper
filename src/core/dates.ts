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
  const year = String(instant.getFullYear()).padStart(4, "0");
  const month = String(instant.getMonth() + 1).padStart(2, "0");
  const day = String(instant.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}` as IsoDate;
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((toUtcMidnight(to) - toUtcMidnight(from)) / MS_PER_DAY);
}

function toUtcMidnight(date: IsoDate): number {
  const [year, month, day] = date.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}
