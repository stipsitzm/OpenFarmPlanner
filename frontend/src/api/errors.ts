/**
 * API error handling utilities.
 * 
 * Provides centralized functions to extract user-friendly error messages
 * from API responses, primarily from Django REST Framework validation errors.
 */

import axios, { AxiosError } from 'axios';

/**
 * Translation function type from i18n.
 */
type TFunction = (key: string, options?: Record<string, unknown>) => string;

/**
 * Extract user-friendly error message from Axios error response.
 * 
 * Handles Django REST Framework validation errors (400 status) and converts
 * them to user-friendly messages with localized field names.
 *
 * @param error - The error object from API call.
 * @param t - Translation function for field names.
 * @param fallbackMessage - Fallback error message if extraction fails.
 * @returns User-friendly error message string.
 */
export function extractApiErrorMessage(
  error: unknown,
  t: TFunction,
  fallbackMessage: string
): string {
  
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError;
    
    // Check if it's a 400 validation error
    if (axiosError.response?.status === 400) {
      const data = axiosError.response.data;
      
      // If data is a string, return it directly
      if (typeof data === 'string') {
        return data;
      }
      
      // If data is an object with error fields
      if (data && typeof data === 'object') {
        const errors: string[] = [];
        
        // Extract field names dynamically from i18n
        Object.entries(data).forEach(([field, value]) => {
          // Try different i18n keys, fallback to field name
          let fieldName = t(`fields.${field}`);
          if (fieldName === `fields.${field}`) {
            fieldName = t(`columns.${field}`);
          }
          if (fieldName === `columns.${field}`) {
            fieldName = t(field);
          }
          if (fieldName === field) {
            // Special case for non_field_errors
            if (field === 'non_field_errors') {
              fieldName = t('messages.error');
            }
          }
          if (!fieldName || fieldName === field) {
            fieldName = field;
          }
          if (Array.isArray(value)) {
            value.forEach((msg: string) => {
              const errorMsg = `${fieldName}: ${msg}`;
              errors.push(errorMsg);
            });
          } else if (typeof value === 'string') {
            const errorMsg = `${fieldName}: ${value}`;
            errors.push(errorMsg);
          }
        });
        
        if (errors.length > 0) {
          const result = errors.join('\n');
          return result;
        }
      }
    }
  }
  
  // Try generic detail extraction for non-400 errors (e.g. 503 with {detail: ...})
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as unknown;
    if (typeof data === 'string' && data.trim().length > 0) {
      return data;
    }
    if (data && typeof data === 'object') {
      const detail = (data as { detail?: unknown }).detail;
      if (typeof detail === 'string' && detail.trim().length > 0) {
        return detail;
      }
      const message = (data as { message?: unknown }).message;
      if (typeof message === 'string' && message.trim().length > 0) {
        return message;
      }
    }
    if (error.message) {
      return error.message;
    }
  }

  // Fallback to generic error message
  return fallbackMessage;
}
