import { describeExpiry, isLive, type Coupon } from "./coupon.ts";
import { daysBetween, type IsoDate } from "./dates.ts";

export interface ReminderPlan {
  /** Coupons to notify about now. */
  readonly toNotify: Coupon[];
  /** The complete reminded-key set to store after notifying. */
  readonly remindedKeys: string[];
}

/**
 * Keyed by expiry as well as id, so correcting a coupon's expiry date
 * re-arms its reminder for the new date.
 */
export function reminderKey(coupon: Coupon): string {
  return `${coupon.id}:${coupon.expiresOn}`;
}

/**
 * Decides which coupons need a reminder and what the reminded set becomes.
 *
 * A coupon qualifies anywhere inside the lead window rather than on one exact
 * day, so a reminder missed while the browser was closed still fires later.
 * `alreadyReminded` prevents repeats.
 *
 * The returned key set keeps only keys for live coupons, so deleted or
 * re-dated coupons don't accumulate stale keys forever.
 */
export function planReminders(
  coupons: readonly Coupon[],
  today: IsoDate,
  leadDays: number,
  alreadyReminded: ReadonlySet<string>,
): ReminderPlan {
  const live = coupons.filter(isLive);

  const toNotify = live.filter((coupon) => {
    const daysLeft = daysBetween(today, coupon.expiresOn);
    const inWindow = daysLeft >= 0 && daysLeft <= leadDays;
    return inWindow && !alreadyReminded.has(reminderKey(coupon));
  });

  const liveKeys = new Set(live.map(reminderKey));
  const stillRelevant = [...alreadyReminded].filter((key) => liveKeys.has(key));
  const remindedKeys = [...new Set([...stillRelevant, ...toNotify.map(reminderKey)])];

  return { toNotify, remindedKeys };
}

export interface ReminderText {
  readonly title: string;
  readonly message: string;
}

export function describeReminder(coupon: Coupon, today: IsoDate): ReminderText {
  return {
    title: `${coupon.store} coupon: ${describeExpiry(coupon.expiresOn, today).toLowerCase()}`,
    message: coupon.notes === "" ? `Code: ${coupon.code}` : `Code: ${coupon.code}\n${coupon.notes}`,
  };
}
