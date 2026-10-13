import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createCoupon,
  describeExpiry,
  groupLiveCouponsByExpiry,
  markDeleted,
  updateCoupon,
  upsertCoupon,
  validateDraft,
  type CouponFields,
} from "../src/core/coupon.ts";
import { parseIsoDate, type IsoDate } from "../src/core/dates.ts";

const day = (text: string) => parseIsoDate(text) as IsoDate;
const TODAY = day("2026-10-12");

function fields(overrides: Partial<CouponFields> = {}): CouponFields {
  return { store: "Newegg", code: "SAVE10", expiresOn: day("2026-11-30"), notes: "", ...overrides };
}

test("validateDraft trims input and returns typed fields", () => {
  const result = validateDraft({ store: " Newegg ", code: " SAVE10 ", expiresOn: "2026-11-30", notes: " " });
  assert.deepEqual(result, { ok: true, fields: fields() });
});

test("validateDraft reports every missing or invalid field", () => {
  const result = validateDraft({ store: "", code: "  ", expiresOn: "2026-02-30", notes: "" });
  assert.equal(result.ok, false);
  if (!result.ok) assert.deepEqual(Object.keys(result.errors).sort(), ["code", "expiresOn", "store"]);
});

test("update and delete stamp updatedAt; delete leaves a tombstone", () => {
  const original = createCoupon(fields(), "a", 1000);
  const edited = updateCoupon(original, fields({ code: "SAVE20" }), 2000);
  assert.equal(edited.code, "SAVE20");
  assert.equal(edited.updatedAt, 2000);

  const deleted = markDeleted(edited, 3000);
  assert.equal(deleted.deletedAt, 3000);
  assert.equal(deleted.updatedAt, 3000);
});

test("upsertCoupon replaces by id or appends", () => {
  const a = createCoupon(fields(), "a", 1);
  const b = createCoupon(fields(), "b", 1);
  const editedA = updateCoupon(a, fields({ store: "Other" }), 2);
  assert.deepEqual(upsertCoupon([a, b], editedA), [editedA, b]);
  assert.deepEqual(upsertCoupon([a], b), [a, b]);
});

test("groupLiveCouponsByExpiry splits, sorts, and skips tombstones", () => {
  const later = createCoupon(fields({ expiresOn: day("2026-12-01") }), "later", 1);
  const today = createCoupon(fields({ expiresOn: TODAY }), "today", 1);
  const longAgo = createCoupon(fields({ expiresOn: day("2026-09-01") }), "longAgo", 1);
  const yesterday = createCoupon(fields({ expiresOn: day("2026-10-11") }), "yesterday", 1);
  const deleted = markDeleted(createCoupon(fields(), "deleted", 1), 2);

  const { active, expired } = groupLiveCouponsByExpiry([later, longAgo, deleted, today, yesterday], TODAY);
  assert.deepEqual(active.map((c) => c.id), ["today", "later"]);
  assert.deepEqual(expired.map((c) => c.id), ["yesterday", "longAgo"]);
});

test("describeExpiry phrases relative days", () => {
  assert.equal(describeExpiry(TODAY, TODAY), "Expires today");
  assert.equal(describeExpiry(day("2026-10-13"), TODAY), "Expires tomorrow");
  assert.equal(describeExpiry(day("2026-10-17"), TODAY), "Expires in 5 days");
  assert.equal(describeExpiry(day("2026-10-11"), TODAY), "Expired yesterday");
  assert.equal(describeExpiry(day("2026-10-02"), TODAY), "Expired 10 days ago");
});
