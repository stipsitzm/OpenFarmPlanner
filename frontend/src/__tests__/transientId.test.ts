import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTransientId } from '../utils/transientId';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createTransientId', () => {
  it('appends timestamp and random suffix to provided parts', () => {
    vi.spyOn(Date, 'now').mockReturnValue(12345);
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    expect(createTransientId('supplier', 7)).toBe('supplier-7-12345-i');
  });

  it('supports ids without a domain prefix', () => {
    vi.spyOn(Date, 'now').mockReturnValue(12345);
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    expect(createTransientId()).toBe('12345-i');
  });
});
