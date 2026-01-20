/**
 * Validation utilities for form fields.
 * 
 * Provides reusable validation functions and helpers
 * for common validation patterns across the application.
 * 
 * @remarks
 * Used by useAutosaveDraft and form components to validate data
 * before sending to the backend API.
 */

import type { ValidationResult } from './useAutosaveDraft';

/**
 * Validator function type
 */
export type Validator<T> = (value: T, fieldName: string) => string | null;

/**
 * Field validation configuration
 */
export interface FieldValidation<T = unknown> {
  /** Field name/path */
  field: keyof T | string;
  /** Array of validator functions to apply */
  validators: Validator<unknown>[];
  /** Optional custom field label for error messages */
  label?: string;
}

/**
 * Validate required field (not empty, null, or undefined)
 */
export const required: Validator<unknown> = (value, fieldName) => {
  if (value === null || value === undefined || value === '') {
    return `${fieldName} is required`;
  }
  return null;
};

/**
 * Validate minimum value for numbers
 */
export const min = (minValue: number): Validator<unknown> => (value, fieldName) => {
  if (value === null || value === undefined || value === '') {
    return null; // Skip if empty (use 'required' to check for presence)
  }
  const numValue = typeof value === 'string' ? parseFloat(value) : (value as number);
  if (isNaN(numValue) || numValue < minValue) {
    return `${fieldName} must be at least ${minValue}`;
  }
  return null;
};

/**
 * Validate maximum value for numbers
 */
export const max = (maxValue: number): Validator<unknown> => (value, fieldName) => {
  if (value === null || value === undefined || value === '') {
    return null; // Skip if empty
  }
  const numValue = typeof value === 'string' ? parseFloat(value) : (value as number);
  if (isNaN(numValue) || numValue > maxValue) {
    return `${fieldName} must be at most ${maxValue}`;
  }
  return null;
};

/**
 * Validate hex color format (#RRGGBB)
 */
export const hexColor: Validator<unknown> = (value, fieldName) => {
  if (!value || value === '') {
    return null; // Skip if empty
  }
  const hexPattern = /^#[0-9A-Fa-f]{6}$/;
  if (!hexPattern.test(String(value))) {
    return `${fieldName} must be a valid hex color (e.g., #FF5733)`;
  }
  return null;
};

/**
 * Validate date format (ISO 8601: YYYY-MM-DD)
 */
export const isoDate: Validator<unknown> = (value, fieldName) => {
  if (!value || value === '') {
    return null; // Skip if empty
  }
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!datePattern.test(String(value))) {
    return `${fieldName} must be a valid date (YYYY-MM-DD)`;
  }
  // Check if it's a valid date
  const date = new Date(String(value));
  if (isNaN(date.getTime())) {
    return `${fieldName} must be a valid date`;
  }
  return null;
};

/**
 * Validate email format
 */
export const email: Validator<unknown> = (value, fieldName) => {
  if (!value || value === '') {
    return null; // Skip if empty
  }
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(String(value))) {
    return `${fieldName} must be a valid email address`;
  }
  return null;
};

/**
 * Validate that value is a positive number
 */
export const positive: Validator<unknown> = (value, fieldName) => {
  if (value === null || value === undefined || value === '') {
    return null; // Skip if empty
  }
  const numValue = typeof value === 'string' ? parseFloat(value) : (value as number);
  if (isNaN(numValue) || numValue <= 0) {
    return `${fieldName} must be a positive number`;
  }
  return null;
};

/**
 * Validate that value is a non-negative number (0 or greater)
 */
export const nonNegative: Validator<unknown> = (value, fieldName) => {
  if (value === null || value === undefined || value === '') {
    return null; // Skip if empty
  }
  const numValue = typeof value === 'string' ? parseFloat(value) : (value as number);
  if (isNaN(numValue) || numValue < 0) {
    return `${fieldName} must be a non-negative number`;
  }
  return null;
};

/**
 * Get nested value from object using dot notation path
 */
export function getNestedValue<T>(obj: T, path: string): unknown {
  const keys = path.split('.');
  let current: unknown = obj;
  
  for (const key of keys) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current === 'object' && key in current) {
      current = (current as Record<string, unknown>)[key];
    } else {
      return undefined;
    }
  }
  
  return current;
}

/**
 * Validate data against field validation rules
 */
export function validateFields<T extends Record<string, unknown>>(
  data: T,
  validations: FieldValidation<T>[]
): ValidationResult {
  const errors: Record<string, string> = {};
  
  for (const validation of validations) {
    const fieldPath = String(validation.field);
    const value = getNestedValue(data, fieldPath);
    const label = validation.label || fieldPath;
    
    for (const validator of validation.validators) {
      const error = validator(value, label);
      if (error) {
        errors[fieldPath] = error;
        break; // Stop at first error for this field
      }
    }
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Create a validator that checks if value is one of allowed values
 */
export const oneOf = <T>(allowedValues: T[]): Validator<unknown> => (value, fieldName) => {
  if (value === null || value === undefined || value === '') {
    return null; // Skip if empty
  }
  if (!allowedValues.includes(value as T)) {
    return `${fieldName} must be one of: ${allowedValues.join(', ')}`;
  }
  return null;
};

/**
 * Create a validator that checks string length
 */
export const maxLength = (max: number): Validator<unknown> => (value, fieldName) => {
  if (!value || value === '') {
    return null; // Skip if empty
  }
  if (String(value).length > max) {
    return `${fieldName} must be at most ${max} characters`;
  }
  return null;
};

/**
 * Create a validator that checks minimum string length
 */
export const minLength = (min: number): Validator<unknown> => (value, fieldName) => {
  if (!value || value === '') {
    return null; // Skip if empty
  }
  if (String(value).length < min) {
    return `${fieldName} must be at least ${min} characters`;
  }
  return null;
};
