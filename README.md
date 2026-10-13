# Coupon Keeper

A browser plugin to store and notify about redemption codes coupon codes you've gotten!

All yours, all private, minimal dependencies! That's it!

I didn't look around much, but I couldn't find a fully private way to just store random codes I sometimes get in emails 
that I know I'll forget about. So this is just really a personal plugin for myself I'll use, and if you use it too glad 
it could help!

The main problem I was trying to solve for myself was getting emails (from birthdays or otherwise) for coupons or codes
and forgetting about them and never ending up using them 😔 so this is to solve that problem.

## Setup

Requires Node 22.18 or later (tests run TypeScript directly through Node's
built-in type stripping).

```sh
npm i
npm run check
npm run build
```

Load `dist/` as an unpacked extension:

- **Chrome:** `chrome://extensions` → enable Developer mode → Load unpacked → pick `dist/`.
- **Firefox:** `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → pick `dist/manifest.json`.

## Layout

```
src/core/       Pure logic: no browser APIs, clock, or randomness. Fully tested.
  dates.ts        IsoDate (calendar day) type, parsing, day arithmetic
  coupon.ts       Coupon type, form validation, create/update/delete, grouping
  reminders.ts    planReminders: which coupons to notify, next reminded set
  settings.ts     Settings type and defaults (reminder lead days = 5)
src/shell/      Browser effects
  storage.ts      Reads/writes chrome.storage.local
src/background.ts   Hourly alarm: load → planReminders → notify → save
src/popup/          Plain-DOM popup UI
test/               node:test suites for src/core
```

## Design notes

- **Expiry is a calendar day** (`"YYYY-MM-DD"`), not a timestamp, so it never
  shifts by a day across time zones.
- **State ownership:** the popup is the only writer of coupons; the background
  is the only writer of the reminded-key set. Settings have no writer yet;
  adding a settings UI only means writing `{ reminderLeadDays }` to storage.
- **Reminders** fire once per coupon anywhere inside the 5-day window, so a
  reminder missed while the browser was closed still arrives. Changing a
  coupon's expiry date re-arms its reminder.
- **Sync-ready data:** random UUID ids, `updatedAt` on every change, and
  deletes kept as tombstones (`deletedAt`), so a future encrypted sync can
  merge per coupon. Stored data carries a `schemaVersion`.


## Roadmap
1. Mullvad-like syncing across browsers (This'll cost me some small amount of money so probably won't do it soon, but if enough people use it why not!) fully encrypted of course!
