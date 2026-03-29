import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthApiError, login, register } from './authApi';

type MockResponse = {
  ok: boolean;
  status: number;
  body: unknown;
};

function installFetchMock(responses: MockResponse[]): void {
  const queue = [...responses];
  vi.stubGlobal('fetch', vi.fn(async () => {
    const next = queue.shift();
    if (!next) {
      throw new Error('Unexpected fetch call');
    }
    const bodyText = typeof next.body === 'string' ? next.body : JSON.stringify(next.body);
    return {
      ok: next.ok,
      status: next.status,
      text: async () => bodyText,
      json: async () => JSON.parse(bodyText),
    } as Response;
  }));
}

describe('authApi error mapping', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    Object.defineProperty(document, 'cookie', {
      configurable: true,
      value: 'csrftoken=test-token',
      writable: true,
    });
  });

  it('does not expose non_field_errors and translates typical login messages', async () => {
    installFetchMock([
      { ok: true, status: 200, body: { detail: 'ok' } },
      {
        ok: false,
        status: 400,
        body: {
          non_field_errors: ['Unable to log in with provided credentials.'],
          password: ['This field is required.'],
        },
      },
    ]);

    try {
      await login('demo@example.com', '');
      throw new Error('Expected login to fail');
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(AuthApiError);
      const authError = error as AuthApiError;
      expect(authError.message).toContain('Anmeldung mit den eingegebenen Zugangsdaten ist fehlgeschlagen.');
      expect(authError.message).toContain('Passwort: Dieses Feld ist erforderlich.');
      expect(authError.message).not.toContain('non_field_errors');
    }
  });

  it('translates common Django password and email validation messages to German', async () => {
    installFetchMock([
      { ok: true, status: 200, body: { detail: 'ok' } },
      {
        ok: false,
        status: 400,
        body: {
          email: ['Enter a valid email address.'],
          password: ['This password is too common.', 'This password is too short.'],
        },
      },
    ]);

    try {
      await register('bad-email', '123', '123');
      throw new Error('Expected register to fail');
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(AuthApiError);
      const authError = error as AuthApiError;
      expect(authError.message).toContain('E-Mail: Bitte gib eine gültige E-Mail-Adresse ein.');
      expect(authError.message).toContain('Passwort: Dieses Passwort ist zu häufig.');
      expect(authError.message).toContain('Passwort: Dieses Passwort ist zu kurz.');
    }
  });
});
