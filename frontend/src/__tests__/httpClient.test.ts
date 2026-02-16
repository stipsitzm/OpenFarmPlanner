/**
 * Tests for httpClient
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import { computeBaseURL, validateBaseURL } from '../api/httpClient';

describe('httpClient', () => {
  describe('computeBaseURL', () => {
    it('should return PROD_API_PATH when in production with no VITE_API_BASE_URL', () => {
      const baseUrl = computeBaseURL(true, undefined);
      expect(baseUrl).toBe('/openfarmplanner/api');
    });

    it('should always return PROD_API_PATH in production regardless of VITE_API_BASE_URL', () => {
      const baseUrl = computeBaseURL(true, 'https://api.example.com');
      expect(baseUrl).toBe('/openfarmplanner/api');
    });

    it('should return VITE_API_BASE_URL in development when set', () => {
      const baseUrl = computeBaseURL(false, 'http://localhost:8000/api');
      expect(baseUrl).toBe('http://localhost:8000/api');
    });

    it('should return PROD_API_PATH in development when VITE_API_BASE_URL is not set', () => {
      const baseUrl = computeBaseURL(false, undefined);
      expect(baseUrl).toBe('/openfarmplanner/api');
    });

    it('should return PROD_API_PATH in development when VITE_API_BASE_URL is empty', () => {
      const baseUrl = computeBaseURL(false, '');
      expect(baseUrl).toBe('/openfarmplanner/api');
    });
  });

  describe('validateBaseURL', () => {
    it('should not throw when localhost is used in development', () => {
      expect(() => {
        validateBaseURL(false, 'http://localhost:8000/api');
      }).not.toThrow();
    });

    it('should not throw when localhost is NOT in baseURL in production', () => {
      expect(() => {
        validateBaseURL(true, 'https://api.example.com');
      }).not.toThrow();
    });

    it('should throw error when localhost is used in production', () => {
      expect(() => {
        validateBaseURL(true, 'http://localhost:8000/api');
      }).toThrow(/FATAL: baseURL must not contain "localhost" in production/);
    });

    it('should throw error when localhost appears anywhere in production URL', () => {
      expect(() => {
        validateBaseURL(true, 'https://localhost-production.com/api');
      }).toThrow(/FATAL: baseURL must not contain "localhost" in production/);
    });

    it('should not throw when not in production even with localhost in URL', () => {
      expect(() => {
        validateBaseURL(false, 'http://localhost-machine.com/api');
      }).not.toThrow();
    });
  });

  describe('httpClient module', () => {
    it('should export default httpClient with axios instance', async () => {
      // Import the real httpClient to verify it exports correctly
      const httpClientModule = await import('../api/httpClient');
      expect(httpClientModule.default).toBeDefined();
      expect(httpClientModule.default.defaults).toBeDefined();
      expect(httpClientModule.default.defaults.headers['Content-Type']).toBe('application/json');
    });

    it('should set correct baseURL in httpClient', async () => {
      const httpClientModule = await import('../api/httpClient');
      expect(httpClientModule.default.defaults.baseURL).toBeDefined();
      expect(typeof httpClientModule.default.defaults.baseURL).toBe('string');
    });

    it('should have Content-Type application/json header configured', async () => {
      const httpClientModule = await import('../api/httpClient');
      expect(httpClientModule.default.defaults.headers['Content-Type']).toBe('application/json');
    });
  });

  describe('axios instance behavior', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should have axios instance with request and response methods', async () => {
      const httpClientModule = await import('../api/httpClient');
      const httpClient = httpClientModule.default;
      
      // Verify axios instance methods exist
      expect(typeof httpClient.get).toBe('function');
      expect(typeof httpClient.post).toBe('function');
      expect(typeof httpClient.put).toBe('function');
      expect(typeof httpClient.delete).toBe('function');
      expect(typeof httpClient.patch).toBe('function');
    });

    it('should have interceptors object', async () => {
      const httpClientModule = await import('../api/httpClient');
      const httpClient = httpClientModule.default;
      
      expect(httpClient.interceptors).toBeDefined();
      expect(httpClient.interceptors.request).toBeDefined();
      expect(httpClient.interceptors.response).toBeDefined();
    });
  });
});

