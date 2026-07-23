/**
 * Pure helpers for deriving a culture's identity key from its name and variety.
 *
 * The identity key is used to detect duplicate cultures regardless of casing or
 * incidental whitespace differences. Keeping the normalization here makes the
 * duplicate-detection rules testable and independent of the form component.
 */

// Null character joining the name and variety. Using an otherwise-unusable
// character as the separator keeps identity keys unambiguous (e.g. it cannot be
// produced by user input that contains spaces).
const IDENTITY_KEY_SEPARATOR = String.fromCharCode(0);

/**
 * Normalizes a free-text identity value: collapses internal whitespace, trims,
 * and lowercases. Returns null for empty input so callers can treat missing and
 * blank values the same way.
 */
export function normalizeCultureIdentityValue(value: string | undefined | null): string | null {
  if (!value) {
    return null;
  }
  const normalized = value.split(/\s+/).filter(Boolean).join(' ').toLowerCase();
  return normalized || null;
}

/**
 * Builds a stable duplicate-detection key from a culture's name and variety.
 * Returns null when either part is missing, since an identity requires both.
 */
export function buildCultureIdentityKey(
  name: string | undefined | null,
  variety: string | undefined | null,
): string | null {
  const normalizedName = normalizeCultureIdentityValue(name);
  const normalizedVariety = normalizeCultureIdentityValue(variety);
  if (!normalizedName || !normalizedVariety) {
    return null;
  }
  return `${normalizedName}${IDENTITY_KEY_SEPARATOR}${normalizedVariety}`;
}
