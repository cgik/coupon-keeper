import { test } from "node:test";
import assert from "node:assert/strict";
import { daysBetween, monthOf, monthWeeks, parseIsoDate, shiftMonth, toLocalIsoDate, type IsoDate } from "../src/core/dates.ts";

const day = (text: string) => parseIsoDate(text) as IsoDate;

test("parseIsoDate accepts real calendar days", () => {
  assert.equal(parseIsoDate("2026-11-30"), "2026-11-30");
  assert.equal(parseIsoDate("2028-02-29"), "2028-02-29");
});

test("parseIsoDate rejects malformed and impossible dates", () => {
  for (const bad of ["", "2026-2-3", "2026-02-30", "2027-02-29", "2026-13-01", "11/30/2026", "2026-11-30T00:00"]) {
    assert.equal(parseIsoDate(bad), null, bad);
  }
});

test("daysBetween counts whole calendar days in both directions", () => {
  assert.equal(daysBetween(day("2026-10-12"), day("2026-10-17")), 5);
  assert.equal(daysBetween(day("2026-10-12"), day("2026-10-12")), 0);
  assert.equal(daysBetween(day("2026-10-12"), day("2026-10-10")), -2);
  assert.equal(daysBetween(day("2026-12-30"), day("2027-01-02")), 3);
});

test("toLocalIsoDate uses the local calendar day", () => {
  assert.equal(toLocalIsoDate(new Date(2026, 0, 5, 23, 59)), "2026-01-05");
});

test("shiftMonth crosses year boundaries in both directions", () => {
  assert.deepEqual(shiftMonth({ year: 2026, month: 12 }, 1), { year: 2027, month: 1 });
  assert.deepEqual(shiftMonth({ year: 2026, month: 1 }, -1), { year: 2025, month: 12 });
  assert.deepEqual(shiftMonth({ year: 2026, month: 5 }, -17), { year: 2024, month: 12 });
});

test("monthOf reads the month an IsoDate falls in", () => {
  assert.deepEqual(monthOf(day("2026-10-16")), { year: 2026, month: 10 });
});

test("monthWeeks lays the month out Sunday-first with blank padding", () => {
  // October 2026 starts on a Thursday and has 31 days.
  const weeks = monthWeeks({ year: 2026, month: 10 });
  assert.equal(weeks.length, 5);
  assert.ok(weeks.every((week) => week.length === 7));
  assert.deepEqual(weeks[0], [null, null, null, null, "2026-10-01", "2026-10-02", "2026-10-03"]);
  assert.deepEqual(weeks[4], ["2026-10-25", "2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31"]);
});

test("monthWeeks handles leap-year February", () => {
  const days = monthWeeks({ year: 2028, month: 2 }).flat().filter((cell) => cell !== null);
  assert.equal(days.length, 29);
  assert.equal(days.at(-1), "2028-02-29");
});
