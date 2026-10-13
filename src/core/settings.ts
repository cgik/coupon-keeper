export interface Settings {
  /** How many days before expiry a reminder fires. */
  readonly reminderLeadDays: number;
}

export const DEFAULT_SETTINGS: Settings = { reminderLeadDays: 5 };

/**
 * Stored settings may be missing or from an older version with fewer fields,
 * so anything absent falls back to the default. There is no settings UI yet;
 * adding one only requires writing this shape to storage.
 */
export function resolveSettings(stored: Partial<Settings> | undefined): Settings {
  return { ...DEFAULT_SETTINGS, ...stored };
}
