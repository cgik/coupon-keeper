import { toLocalIsoDate, type IsoDate } from "./core/dates.ts";
import type { Coupon } from "./core/coupon.ts";
import { describeReminder, planReminders } from "./core/reminders.ts";
import { loadCoupons, loadRemindedKeys, loadSettings, saveRemindedKeys } from "./shell/storage.ts";

/*
 * Runs as a service worker in Chrome and an event page in Firefox. Both are
 * torn down when idle, so nothing here lives in memory between events, and
 * every listener is registered synchronously at top level so the browser can
 * wake the script for it.
 */

const REMINDER_ALARM = "check-reminders";

// Hourly rather than daily: periodic alarms drift while a machine sleeps,
// and extra checks are harmless because already-reminded coupons are skipped.
const REMINDER_CHECK_PERIOD_MINUTES = 60;

chrome.runtime.onInstalled.addListener(() => void startReminderChecks());
chrome.runtime.onStartup.addListener(() => void startReminderChecks());
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === REMINDER_ALARM) void runReminderCheck();
});

async function startReminderChecks(): Promise<void> {
  // Alarms are not guaranteed to survive a browser restart, so recreate if missing.
  const existing = await chrome.alarms.get(REMINDER_ALARM);
  if (existing === undefined) {
    await chrome.alarms.create(REMINDER_ALARM, { periodInMinutes: REMINDER_CHECK_PERIOD_MINUTES });
  }
  await runReminderCheck();
}

async function runReminderCheck(): Promise<void> {
  const [coupons, settings, alreadyReminded] = await Promise.all([
    loadCoupons(),
    loadSettings(),
    loadRemindedKeys(),
  ]);
  const today = toLocalIsoDate(new Date());

  const plan = planReminders(coupons, today, settings.reminderLeadDays, alreadyReminded);

  // Notify before recording: if the worker dies in between, a duplicate
  // reminder is better than a silently skipped one.
  await Promise.all(plan.toNotify.map((coupon) => showReminder(coupon, today)));
  await saveRemindedKeys(plan.remindedKeys);
}

async function showReminder(coupon: Coupon, today: IsoDate): Promise<void> {
  const { title, message } = describeReminder(coupon, today);
  await chrome.notifications.create(`reminder:${coupon.id}`, {
    type: "basic",
    iconUrl: chrome.runtime.getURL("icons/icon-128.png"),
    title,
    message,
  });
}
