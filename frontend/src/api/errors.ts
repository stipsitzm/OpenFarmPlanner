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
  console.log('extractApiErrorMessage called with:', error);
  
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError;
    console.log('Is Axios error, status:', axiosError.response?.status);
    console.log('Response data:', axiosError.response?.data);
    
    // Check if it's a 400 validation error
    if (axiosError.response?.status === 400) {
      const data = axiosError.response.data;
      console.log('Data type:', typeof data);
      
      // If data is a string, return it directly
      if (typeof data === 'string') {
        console.log('Returning string data:', data);
        return data;
      }
      
      // If data is an object with error fields
      if (data && typeof data === 'object') {
        const errors: string[] = [];
        
        // Extract field names dynamically from i18n
        Object.entries(data).forEach(([field, value]) => {
          console.log(`Processing field ${field}:`, value);
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
              console.log('Adding error:', errorMsg);
              errors.push(errorMsg);
            });
          } else if (typeof value === 'string') {
            const errorMsg = `${fieldName}: ${value}`;
            console.log('Adding error:', errorMsg);
            errors.push(errorMsg);
          }
        });
        
        if (errors.length > 0) {
          const result = errors.join('\n');
          console.log('Returning joined errors:', result);
          return result;
        }
      }
    }
  }
  
  // Fallback to generic error message
  console.log('Fallback to generic error');
  return fallbackMessage;
}
