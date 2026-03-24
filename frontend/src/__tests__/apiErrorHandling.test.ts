import { describe, expect, it } from 'vitest';
import { AxiosError } from 'axios';
import { extractApiErrorMessage } from '../api/errors';

const t = (key: string): string => key;

describe('extractApiErrorMessage', () => {
  it('falls back for HTML error pages instead of returning raw markup', () => {
    const error = new AxiosError('Request failed');
    error.response = {
      data: '<!DOCTYPE html><html><body><h1>Server Error (500)</h1></body></html>',
      status: 500,
      statusText: 'Internal Server Error',
      headers: { 'content-type': 'text/html; charset=utf-8' },
      config: { headers: {} },
    };

    expect(extractApiErrorMessage(error, t, 'Allgemeiner Fehler')).toBe('Allgemeiner Fehler');
  });
});
