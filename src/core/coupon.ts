import { daysBetween, parseIsoDate, type IsoDate } from "./dates.ts";

export interface Coupon {
  readonly id: string;
  readonly store: string;
  readonly code: string;
  readonly expiresOn: IsoDate;
  readonly notes: string;
  /** Epoch ms of the last change; the future sync merge compares these. */
  readonly updatedAt: number;
  /** Epoch ms of deletion, or null while live. Deleted coupons are kept as tombstones for sync. */
  readonly deletedAt: number | null;
}

/** The user-editable part of a coupon, already validated. */
export interface CouponFields {
  readonly store: string;
  readonly code: string;
  readonly expiresOn: IsoDate;
  readonly notes: string;
}

/** Raw form input, before validation. */
export interface CouponDraft {
  readonly store: string;
  readonly code: string;
  readonly expiresOn: string;
  readonly notes: string;
}

export type DraftErrors = Partial<Record<keyof CouponDraft, string>>;

export type DraftValidation =
  | { readonly ok: true; readonly fields: CouponFields }
  | { readonly ok: false; readonly errors: DraftErrors };

export function validateDraft(draft: CouponDraft): DraftValidation {
  const store = draft.store.trim();
  const code = draft.code.trim();
  const notes = draft.notes.trim();
  const expiresOn = parseIsoDate(draft.expiresOn.trim());

  const errors: DraftErrors = {};
  if (store === "") errors.store = "Store is required.";
  if (code === "") errors.code = "Code is required.";
  if (expiresOn === null) errors.expiresOn = "Enter a date as YYYY-MM-DD, or use Pick date.";

  if (expiresOn === null || Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, fields: { store, code, expiresOn, notes } };
}

export function createCoupon(fields: CouponFields, id: string, now: number): Coupon {
  return { id, ...fields, updatedAt: now, deletedAt: null };
}

export function updateCoupon(coupon: Coupon, fields: CouponFields, now: number): Coupon {
  return { ...coupon, ...fields, updatedAt: now };
}

export function markDeleted(coupon: Coupon, now: number): Coupon {
  return { ...coupon, deletedAt: now, updatedAt: now };
}

export function isLive(coupon: Coupon): boolean {
  return coupon.deletedAt === null;
}

/** Returns `coupons` with the entry whose id matches `next.id` replaced, or `next` appended. */
export function upsertCoupon(coupons: readonly Coupon[], next: Coupon): Coupon[] {
  const exists = coupons.some((coupon) => coupon.id === next.id);
  return exists
    ? coupons.map((coupon) => (coupon.id === next.id ? next : coupon))
    : [...coupons, next];
}

export interface CouponsByExpiry {
  /** Expiring today or later, soonest first. */
  readonly active: Coupon[];
  /** Already past their expiry day, most recently expired first. */
  readonly expired: Coupon[];
}

export function groupLiveCouponsByExpiry(
  coupons: readonly Coupon[],
  today: IsoDate,
): CouponsByExpiry {
  const live = coupons.filter(isLive);
  const active = live.filter((coupon) => daysBetween(today, coupon.expiresOn) >= 0);
  const expired = live.filter((coupon) => daysBetween(today, coupon.expiresOn) < 0);

  // IsoDate strings sort chronologically as plain strings.
  active.sort((a, b) => a.expiresOn.localeCompare(b.expiresOn));
  expired.sort((a, b) => b.expiresOn.localeCompare(a.expiresOn));
  return { active, expired };
}

export function describeExpiry(expiresOn: IsoDate, today: IsoDate): string {
  const days = daysBetween(today, expiresOn);
  if (days === 0) return "Expires today";
  if (days === 1) return "Expires tomorrow";
  if (days > 1) return `Expires in ${days} days`;
  if (days === -1) return "Expired yesterday";
  return `Expired ${-days} days ago`;
}
