import type { Coupon } from "../core/coupon.ts";
import { resolveSettings, type Settings } from "../core/settings.ts";

/*
 * Ownership of stored state:
 * - "couponStore": written only by the popup. The background only reads it.
 * - "remindedKeys": written only by the background.
 * - "settings": no writer yet; read with defaults.
 * Keeping writers on separate keys means the popup and background can never
 * overwrite each other's read-modify-write.
 */

const COUPON_STORE_KEY = "couponStore";
const REMINDED_KEYS_KEY = "remindedKeys";
const SETTINGS_KEY = "settings";

const CURRENT_SCHEMA_VERSION = 1;

interface CouponStoreV1 {
  readonly schemaVersion: 1;
  readonly coupons: Coupon[];
}

export async function loadCoupons(): Promise<Coupon[]> {
  const stored = await chrome.storage.local.get(COUPON_STORE_KEY);
  const couponStore = stored[COUPON_STORE_KEY] as CouponStoreV1 | undefined;
  if (couponStore === undefined) return [];

  // Refuse unknown versions instead of guessing: a newer build may have
  // written this, and saving over it from an older build would lose data.
  if (couponStore.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    throw new Error(`Unsupported coupon schema version ${String(couponStore.schemaVersion)}`);
  }
  return couponStore.coupons;
}

export async function saveCoupons(coupons: readonly Coupon[]): Promise<void> {
  const couponStore: CouponStoreV1 = { schemaVersion: CURRENT_SCHEMA_VERSION, coupons: [...coupons] };
  await chrome.storage.local.set({ [COUPON_STORE_KEY]: couponStore });
}

export async function loadRemindedKeys(): Promise<Set<string>> {
  const stored = await chrome.storage.local.get(REMINDED_KEYS_KEY);
  return new Set((stored[REMINDED_KEYS_KEY] as string[] | undefined) ?? []);
}

export async function saveRemindedKeys(keys: readonly string[]): Promise<void> {
  await chrome.storage.local.set({ [REMINDED_KEYS_KEY]: [...keys] });
}

export async function loadSettings(): Promise<Settings> {
  const stored = await chrome.storage.local.get(SETTINGS_KEY);
  return resolveSettings(stored[SETTINGS_KEY] as Partial<Settings> | undefined);
}
