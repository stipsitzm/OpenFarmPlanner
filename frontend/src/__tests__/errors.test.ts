import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { extractApiErrorMessage } from '../api/errors';

const fallbackMessage = 'Ein Fehler ist aufgetreten';

type TranslationMap = Record<string, string>;

function createT(translations: TranslationMap) {
  return (key: string) => translations[key] ?? key;
}

function createAxiosError(status: number, data: unknown) {
  return {
    isAxiosError: true,
    response: {
      status,
      data,
    },
  };
}

describe('extractApiErrorMessage', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns fallback message for non-axios errors', () => {
    const t = createT({});

    const result = extractApiErrorMessage(new Error('boom'), t, fallbackMessage);

    expect(result).toBe(fallbackMessage);
  });

  it('returns fallback message for axios errors with non-400 status', () => {
    const t = createT({});
    const error = createAxiosError(500, { detail: 'Serverfehler' });

    const result = extractApiErrorMessage(error, t, fallbackMessage);

    expect(result).toBe(fallbackMessage);
  });




  it('returns generic server message for HTML error pages', () => {
    const t = createT({
      'ai.serverUnavailable': 'Server derzeit nicht erreichbar.',
    });
    const error = createAxiosError(500, '<!DOCTYPE html><html><body>500 Internal Server Error</body></html>');

    const result = extractApiErrorMessage(error, t, fallbackMessage);

    expect(result).toBe('Server derzeit nicht erreichbar.');
  });

  it('returns generic server message for 500 object responses', () => {
    const t = createT({
      'ai.serverUnavailable': 'Server derzeit nicht erreichbar.',
    });
    const error = createAxiosError(500, { detail: 'Internal server error' });

    const result = extractApiErrorMessage(error, t, fallbackMessage);

    expect(result).toBe('Server derzeit nicht erreichbar.');
  });

  it('maps 503 insufficient_quota details to a friendly message', () => {
    const t = createT({
      'ai.quotaExceeded': 'OpenAI-Kontingent aufgebraucht.',
    });

    const error = createAxiosError(503, {
      detail: 'OpenAI responses error: 429 {"error":{"code":"insufficient_quota"}}',
    });

    const result = extractApiErrorMessage(error, t, fallbackMessage);

    expect(result).toBe('OpenAI-Kontingent aufgebraucht.');
  });

  it('maps 503 no-web-research detail to a friendly message', () => {
    const t = createT({
      'ai.webResearchUnavailable': 'Web-Recherche ist nicht konfiguriert.',
    });

    const error = createAxiosError(503, {
      detail: 'No web-research provider configured.',
    });

    const result = extractApiErrorMessage(error, t, fallbackMessage);

    expect(result).toBe('Web-Recherche ist nicht konfiguriert.');
  });

  it('returns 503 detail unchanged when no special mapping applies', () => {
    const t = createT({});

    const error = createAxiosError(503, {
      detail: 'Temporärer Dienstfehler',
    });

    const result = extractApiErrorMessage(error, t, fallbackMessage);

    expect(result).toBe('Temporärer Dienstfehler');
  });
  it('returns server message directly when 400 data is a string', () => {
    const t = createT({});
    const error = createAxiosError(400, 'Ungültige Anfrage');

    const result = extractApiErrorMessage(error, t, fallbackMessage);

    expect(result).toBe('Ungültige Anfrage');
  });

  it('formats 400 validation object errors with translated field names', () => {
    const t = createT({
      'fields.name': 'Name',
      'columns.category': 'Kategorie',
      description: 'Beschreibung',
    });

    const error = createAxiosError(400, {
      name: ['Darf nicht leer sein'],
      category: ['Ist ungültig'],
      description: 'Zu lang',
    });

    const result = extractApiErrorMessage(error, t, fallbackMessage);

    expect(result).toBe([
      'Name: Darf nicht leer sein',
      'Kategorie: Ist ungültig',
      'Beschreibung: Zu lang',
    ].join('\n'));
  });



  it('returns fallback when 400 object has no string or array messages', () => {
    const t = createT({});
    const error = createAxiosError(400, {
      amount: 123,
      active: false,
    });

    const result = extractApiErrorMessage(error, t, fallbackMessage);

    expect(result).toBe(fallbackMessage);
  });

  it('falls back to raw field name when translation is empty', () => {
    const t = createT({
      'messages.error': '',
    });

    const error = createAxiosError(400, {
      non_field_errors: ['Unbekannter Validierungsfehler'],
    });

    const result = extractApiErrorMessage(error, t, fallbackMessage);

    expect(result).toBe('non_field_errors: Unbekannter Validierungsfehler');
  });
  it('uses generic error translation for non_field_errors and raw field as final fallback', () => {
    const t = createT({
      'messages.error': 'Allgemeiner Fehler',
    });

    const error = createAxiosError(400, {
      non_field_errors: ['Kombination ist nicht erlaubt'],
      unknown_field: ['Ungültiger Wert'],
    });

    const result = extractApiErrorMessage(error, t, fallbackMessage);

    expect(result).toBe([
      'Allgemeiner Fehler: Kombination ist nicht erlaubt',
      'unknown_field: Ungültiger Wert',
    ].join('\n'));
  });
});
