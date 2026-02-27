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

function translatedOrFallback(t: TFunction, key: string, fallback: string): string {
  const translated = t(key);
  return translated === key ? fallback : translated;
}

function formatServiceError(detail: string, t: TFunction, fallbackMessage: string): string {
  const normalized = detail.toLowerCase();

  if (normalized.includes('insufficient_quota')) {
    return translatedOrFallback(
      t,
      'ai.quotaExceeded',
      'OpenAI-Kontingent aufgebraucht. Bitte Abrechnung/Plan prüfen und erneut versuchen.',
    );
  }

  if (normalized.includes('no web-research provider configured')) {
    return translatedOrFallback(
      t,
      'ai.webResearchUnavailable',
      'Kein Web-Research-Provider konfiguriert. Bitte AI_ENRICHMENT_PROVIDER prüfen.',
    );
  }

  if (normalized.includes('openai responses error: 429')) {
    return translatedOrFallback(
      t,
      'ai.providerRateLimited',
      'OpenAI hat die Anfrage wegen Rate-Limit/Limitierung abgelehnt. Bitte später erneut versuchen.',
    );
  }

  if (normalized.includes('openai request failed')) {
    return translatedOrFallback(
      t,
      'ai.providerUnavailable',
      'OpenAI ist derzeit nicht erreichbar. Bitte später erneut versuchen.',
    );
  }

  return detail || fallbackMessage;
}

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
    const status = axiosError.response?.status;
    const data = axiosError.response?.data;

    if (typeof data === 'string') {
      return status === 503 ? formatServiceError(data, t, fallbackMessage) : data;
    }

    if (status === 503 && data && typeof data === 'object' && 'detail' in data && typeof data.detail === 'string') {
      return formatServiceError(data.detail, t, fallbackMessage);
    }

    // Check if it's a 400 validation error
    if (status === 400) {
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

  // Fallback to generic error message
  return fallbackMessage;
}


/**
 * Detects whether an Axios request was canceled/aborted by the client.
 */
export function isApiRequestCanceled(error: unknown): boolean {
  if (!axios.isAxiosError(error)) {
    return false;
  }
  const axiosError = error as AxiosError;
  return axiosError.code === 'ERR_CANCELED';
}
