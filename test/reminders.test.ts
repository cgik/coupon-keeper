import { test } from "node:test";
import assert from "node:assert/strict";
import { createCoupon, markDeleted, updateCoupon, type Coupon } from "../src/core/coupon.ts";
import { parseIsoDate, type IsoDate } from "../src/core/dates.ts";
import { describeReminder, planReminders, reminderKey } from "../src/core/reminders.ts";

const day = (text: string) => parseIsoDate(text) as IsoDate;
const TODAY = day("2026-10-12");
const LEAD_DAYS = 5;

function coupon(id: string, expiresOn: string, notes = ""): Coupon {
  return createCoupon({ store: "Newegg", code: "SAVE10", expiresOn: day(expiresOn), notes }, id, 1);
}

const ids = (coupons: Coupon[]) => coupons.map((c) => c.id);

test("notifies coupons inside the window, including its edges", () => {
  const coupons = [
    coupon("today", "2026-10-12"),
    coupon("edge", "2026-10-17"),
    coupon("outside", "2026-10-18"),
    coupon("expired", "2026-10-11"),
  ];
  const plan = planReminders(coupons, TODAY, LEAD_DAYS, new Set());
  assert.deepEqual(ids(plan.toNotify), ["today", "edge"]);
});

test("a reminder missed while the browser was closed still fires", () => {
  // Entered the window days ago; never reminded.
  const plan = planReminders([coupon("late", "2026-10-14")], TODAY, LEAD_DAYS, new Set());
  assert.deepEqual(ids(plan.toNotify), ["late"]);
});

test("never notifies the same coupon twice", () => {
  const c = coupon("a", "2026-10-14");
  const first = planReminders([c], TODAY, LEAD_DAYS, new Set());
  const second = planReminders([c], TODAY, LEAD_DAYS, new Set(first.remindedKeys));
  assert.deepEqual(ids(second.toNotify), []);
  assert.deepEqual(second.remindedKeys, [reminderKey(c)]);
});

test("changing the expiry date re-arms the reminder", () => {
  const original = coupon("a", "2026-10-14");
  const redated = updateCoupon(original, { ...original, expiresOn: day("2026-10-16") }, 2);
  const plan = planReminders([redated], TODAY, LEAD_DAYS, new Set([reminderKey(original)]));
  assert.deepEqual(ids(plan.toNotify), ["a"]);
  assert.deepEqual(plan.remindedKeys, [reminderKey(redated)]);
});

test("deleted coupons are neither notified nor kept in the reminded set", () => {
  const live = coupon("live", "2026-10-13");
  const deleted = markDeleted(coupon("gone", "2026-10-13"), 2);
  const plan = planReminders([live, deleted], TODAY, LEAD_DAYS, new Set([reminderKey(deleted)]));
  assert.deepEqual(ids(plan.toNotify), ["live"]);
  assert.deepEqual(plan.remindedKeys, [reminderKey(live)]);
});

test("describeReminder includes code and optional notes", () => {
  assert.deepEqual(describeReminder(coupon("a", "2026-10-14"), TODAY), {
    title: "Newegg coupon: expires in 2 days",
    message: "Code: SAVE10",
  });
  assert.equal(describeReminder(coupon("a", "2026-10-14", "Min $50"), TODAY).message, "Code: SAVE10\nMin $50");
});
