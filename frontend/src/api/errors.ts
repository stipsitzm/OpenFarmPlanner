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

const fieldLabelFallbacks: Record<string, string> = {
  area_usage_sqm: 'Fläche (m²)',
  area_sqm: 'Fläche (m²)',
  planting_date: 'Pflanzdatum',
  harvest_date: 'Erntebeginn',
  harvest_end_date: 'Ernteende',
  quantity: 'Pflanzen',
  cultivation_type: 'Anbauart',
  culture: 'Kultur',
  bed: 'Beet',
  field: 'Schlag',
  location: 'Standort',
  non_field_errors: 'Fehler',
};

function translatedOrFallback(t: TFunction, key: string, fallback: string): string {
  const translated = t(key);
  return translated === key ? fallback : translated;
}


const backendMessageMap: Record<string, string> = {
  'this field is required.': 'validation.required',
  'enter a valid email address.': 'validation.invalidEmail',
  'no public cultures found': 'errors.noPublicCultures',
  'bed not found.': 'errors.bedNotFound',
  'uploaded file exceeds the 10mb size limit.': 'errors.fileTooLarge',
  'uploaded file is not a valid image.': 'errors.invalidImage',
};

function localizeBackendMessage(message: string, t: TFunction): string {
  const normalized = message.trim().toLowerCase();
  const key = backendMessageMap[normalized];
  if (key) {
    return translatedOrFallback(t, key, message);
  }
  if (/^ensure this field has at least (\d+) characters\.$/i.test(message)) {
    const count = Number(message.match(/(\d+)/)?.[1] ?? 0);
    return translatedOrFallback(t, 'validation.minLength', message).replace('{{count}}', String(count));
  }
  return message;
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

  return localizeBackendMessage(detail || fallbackMessage, t);
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
      const trimmed = data.trim();
      const contentType = axiosError.response?.headers?.['content-type'];
      const looksLikeHtml = trimmed.startsWith('<!DOCTYPE html') || trimmed.startsWith('<html');
      if (looksLikeHtml || (typeof contentType === 'string' && contentType.includes('text/html'))) {
        return translatedOrFallback(t, 'errors.generic', fallbackMessage);
      }
      return status === 503 ? formatServiceError(data, t, fallbackMessage) : localizeBackendMessage(data, t);
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
          if (!fieldName || fieldName === field) {
            fieldName = fieldLabelFallbacks[field] ?? field;
          }
          if (Array.isArray(value)) {
            value.forEach((msg: string) => {
              const errorMsg = `${fieldName}: ${localizeBackendMessage(msg, t)}`;
              errors.push(errorMsg);
            });
          } else if (typeof value === 'string') {
            const errorMsg = `${fieldName}: ${localizeBackendMessage(value, t)}`;
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
  return translatedOrFallback(t, 'errors.generic', fallbackMessage);
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
