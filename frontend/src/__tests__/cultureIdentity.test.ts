import { describe, expect, it } from 'vitest';
import {
  buildCultureIdentityKey,
  normalizeCultureIdentityValue,
} from '../cultures/cultureIdentity';

const SEPARATOR = String.fromCharCode(0);

describe('normalizeCultureIdentityValue', () => {
  it('collapses whitespace, trims, and lowercases', () => {
    expect(normalizeCultureIdentityValue('  Roter   Mangold ')).toBe('roter mangold');
  });

  it('returns null for empty or whitespace-only input', () => {
    expect(normalizeCultureIdentityValue('')).toBeNull();
    expect(normalizeCultureIdentityValue('   ')).toBeNull();
    expect(normalizeCultureIdentityValue(null)).toBeNull();
    expect(normalizeCultureIdentityValue(undefined)).toBeNull();
  });
});

describe('buildCultureIdentityKey', () => {
  it('joins normalized name and variety with a stable separator', () => {
    expect(buildCultureIdentityKey('Tomate', 'Roma')).toBe(`tomate${SEPARATOR}roma`);
  });

  it('treats casing and whitespace differences as the same identity', () => {
    expect(buildCultureIdentityKey('  TOMATE ', 'roma')).toBe(
      buildCultureIdentityKey('tomate', 'Roma'),
    );
  });

  it('returns null when either name or variety is missing', () => {
    expect(buildCultureIdentityKey('Tomate', '')).toBeNull();
    expect(buildCultureIdentityKey('', 'Roma')).toBeNull();
    expect(buildCultureIdentityKey(null, null)).toBeNull();
  });
});
