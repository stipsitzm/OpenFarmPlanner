/**
 * Tests for validation utilities
 */

import { describe, it, expect } from 'vitest';
import {
  required,
  min,
  max,
  hexColor,
  isoDate,
  email,
  positive,
  nonNegative,
  oneOf,
  maxLength,
  minLength,
  validateFields,
  getNestedValue,
} from '../hooks/validation';

describe('Validation Utilities', () => {
  describe('required', () => {
    it('should return error for empty values', () => {
      expect(required('', 'Field')).toBe('Field is required');
      expect(required(null, 'Field')).toBe('Field is required');
      expect(required(undefined, 'Field')).toBe('Field is required');
    });

    it('should return null for non-empty values', () => {
      expect(required('value', 'Field')).toBeNull();
      expect(required(0, 'Field')).toBeNull();
      expect(required(false, 'Field')).toBeNull();
    });
  });

  describe('min', () => {
    it('should return error for values below minimum', () => {
      const validator = min(10);
      expect(validator(5, 'Field')).toContain('at least 10');
      expect(validator('5', 'Field')).toContain('at least 10');
    });

    it('should return null for values at or above minimum', () => {
      const validator = min(10);
      expect(validator(10, 'Field')).toBeNull();
      expect(validator(15, 'Field')).toBeNull();
    });

    it('should skip empty values', () => {
      const validator = min(10);
      expect(validator('', 'Field')).toBeNull();
      expect(validator(null, 'Field')).toBeNull();
    });
  });

  describe('max', () => {
    it('should return error for values above maximum', () => {
      const validator = max(100);
      expect(validator(150, 'Field')).toContain('at most 100');
    });

    it('should return null for values at or below maximum', () => {
      const validator = max(100);
      expect(validator(100, 'Field')).toBeNull();
      expect(validator(50, 'Field')).toBeNull();
    });
  });

  describe('hexColor', () => {
    it('should return error for invalid hex colors', () => {
      expect(hexColor('red', 'Color')).toContain('valid hex color');
      expect(hexColor('#12345', 'Color')).toContain('valid hex color');
      expect(hexColor('#GGGGGG', 'Color')).toContain('valid hex color');
    });

    it('should return null for valid hex colors', () => {
      expect(hexColor('#FF5733', 'Color')).toBeNull();
      expect(hexColor('#ffffff', 'Color')).toBeNull();
      expect(hexColor('#000000', 'Color')).toBeNull();
    });

    it('should skip empty values', () => {
      expect(hexColor('', 'Color')).toBeNull();
    });
  });

  describe('isoDate', () => {
    it('should return error for invalid dates', () => {
      expect(isoDate('2024-13-01', 'Date')).toContain('valid date');
      expect(isoDate('not-a-date', 'Date')).toContain('valid date');
      expect(isoDate('2024/01/01', 'Date')).toContain('YYYY-MM-DD');
    });

    it('should return null for valid ISO dates', () => {
      expect(isoDate('2024-01-01', 'Date')).toBeNull();
      expect(isoDate('2024-12-31', 'Date')).toBeNull();
    });

    it('should skip empty values', () => {
      expect(isoDate('', 'Date')).toBeNull();
    });
  });

  describe('email', () => {
    it('should return error for invalid emails', () => {
      expect(email('notanemail', 'Email')).toContain('valid email');
      expect(email('test@', 'Email')).toContain('valid email');
      expect(email('@example.com', 'Email')).toContain('valid email');
    });

    it('should return null for valid emails', () => {
      expect(email('test@example.com', 'Email')).toBeNull();
      expect(email('user+tag@domain.co.uk', 'Email')).toBeNull();
    });
  });

  describe('positive', () => {
    it('should return error for non-positive values', () => {
      expect(positive(0, 'Field')).toContain('positive number');
      expect(positive(-5, 'Field')).toContain('positive number');
    });

    it('should return null for positive values', () => {
      expect(positive(1, 'Field')).toBeNull();
      expect(positive(100, 'Field')).toBeNull();
    });
  });

  describe('nonNegative', () => {
    it('should return error for negative values', () => {
      expect(nonNegative(-1, 'Field')).toContain('non-negative');
      expect(nonNegative(-100, 'Field')).toContain('non-negative');
    });

    it('should return null for non-negative values', () => {
      expect(nonNegative(0, 'Field')).toBeNull();
      expect(nonNegative(100, 'Field')).toBeNull();
    });
  });

  describe('oneOf', () => {
    it('should return error for values not in allowed list', () => {
      const validator = oneOf(['a', 'b', 'c']);
      expect(validator('d', 'Field')).toContain('must be one of');
    });

    it('should return null for values in allowed list', () => {
      const validator = oneOf(['a', 'b', 'c']);
      expect(validator('a', 'Field')).toBeNull();
      expect(validator('b', 'Field')).toBeNull();
    });
  });

  describe('maxLength', () => {
    it('should return error for strings too long', () => {
      const validator = maxLength(5);
      expect(validator('toolong', 'Field')).toContain('at most 5 characters');
    });

    it('should return null for strings within limit', () => {
      const validator = maxLength(5);
      expect(validator('ok', 'Field')).toBeNull();
      expect(validator('12345', 'Field')).toBeNull();
    });
  });

  describe('minLength', () => {
    it('should return error for strings too short', () => {
      const validator = minLength(5);
      expect(validator('abc', 'Field')).toContain('at least 5 characters');
    });

    it('should return null for strings meeting minimum', () => {
      const validator = minLength(5);
      expect(validator('12345', 'Field')).toBeNull();
      expect(validator('longer', 'Field')).toBeNull();
    });
  });

  describe('getNestedValue', () => {
    it('should get nested values using dot notation', () => {
      const obj = {
        a: 1,
        b: {
          c: 2,
          d: {
            e: 3,
          },
        },
      };
      expect(getNestedValue(obj, 'a')).toBe(1);
      expect(getNestedValue(obj, 'b.c')).toBe(2);
      expect(getNestedValue(obj, 'b.d.e')).toBe(3);
    });

    it('should return undefined for non-existent paths', () => {
      const obj = { a: 1 };
      expect(getNestedValue(obj, 'b')).toBeUndefined();
      expect(getNestedValue(obj, 'a.b.c')).toBeUndefined();
    });
  });

  describe('validateFields', () => {
    it('should validate multiple fields', () => {
      const data = {
        name: '',
        age: -5,
        email: 'test@example.com',
      };

      const result = validateFields(data, [
        { field: 'name', validators: [required] },
        { field: 'age', validators: [required, nonNegative] },
        { field: 'email', validators: [email] },
      ]);

      expect(result.isValid).toBe(false);
      expect(result.errors.name).toBeDefined();
      expect(result.errors.age).toBeDefined();
      expect(result.errors.email).toBeUndefined();
    });

    it('should return valid result when all fields pass', () => {
      const data = {
        name: 'John',
        age: 25,
        email: 'john@example.com',
      };

      const result = validateFields(data, [
        { field: 'name', validators: [required] },
        { field: 'age', validators: [required, nonNegative] },
        { field: 'email', validators: [email] },
      ]);

      expect(result.isValid).toBe(true);
      expect(Object.keys(result.errors).length).toBe(0);
    });

    it('should use custom labels in error messages', () => {
      const data = { name: '' };

      const result = validateFields(data, [
        { field: 'name', validators: [required], label: 'Full Name' },
      ]);

      expect(result.errors.name).toContain('Full Name');
    });
  });

  describe('additional edge cases', () => {
    it('handles NaN-like string values in numeric validators', () => {
      expect(min(1)('abc', 'Amount')).toBe('Amount must be at least 1');
      expect(max(10)('abc', 'Amount')).toBe('Amount must be at most 10');
      expect(positive('abc', 'Amount')).toBe('Amount must be a positive number');
      expect(nonNegative('abc', 'Amount')).toBe('Amount must be a non-negative number');
    });

    it('skips empty input in optional validators', () => {
      expect(email('', 'Email')).toBeNull();
      expect(oneOf(['x', 'y'])('', 'Type')).toBeNull();
      expect(maxLength(3)('', 'Code')).toBeNull();
      expect(minLength(3)('', 'Code')).toBeNull();
      expect(max(10)(null, 'Amount')).toBeNull();
      expect(max(10)(undefined, 'Amount')).toBeNull();
      expect(positive(null, 'Amount')).toBeNull();
      expect(positive(undefined, 'Amount')).toBeNull();
      expect(nonNegative(null, 'Amount')).toBeNull();
      expect(nonNegative(undefined, 'Amount')).toBeNull();
    });

    it('returns undefined for nested path through null object', () => {
      const obj = { nested: null as null | { value: number } };
      expect(getNestedValue(obj, 'nested.value')).toBeUndefined();
    });

    it('stops validation at first failing validator per field', () => {
      const secondValidator = (value: unknown) => (value ? null : 'second error');
      const result = validateFields(
        { title: '' },
        [{ field: 'title', validators: [required, secondValidator] }]
      );

      expect(result.errors.title).toBe('title is required');
    });
  });

});
