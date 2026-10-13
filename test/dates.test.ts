import { test } from "node:test";
import assert from "node:assert/strict";
import { daysBetween, parseIsoDate, toLocalIsoDate, type IsoDate } from "../src/core/dates.ts";

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
