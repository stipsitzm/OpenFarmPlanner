/**
 * Export all autosave-related hooks and utilities
 */

export { useAutosaveDraft } from './useAutosaveDraft';
export type {
  UseAutosaveDraftOptions,
  UseAutosaveDraftReturn,
  ValidationResult,
  SaveReason,
} from './useAutosaveDraft';

export { useNavigationBlocker } from './useNavigationBlocker';

export {
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
} from './validation';
export type { Validator, FieldValidation } from './validation';
