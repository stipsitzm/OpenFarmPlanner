import axios from 'axios';

const PROD_API_PATH = '/openfarmplanner/api';

/**
 * Computes the baseURL based on environment flags and API base URL configuration.
 *
 * In production, always uses PROD_API_PATH to prevent accidental server misconfiguration.
 * In development, allows VITE_API_BASE_URL to override for flexibility.
 *
 * @param isProd - Whether the build is production.
 * @param viteApiBaseUrl - Base URL from VITE_API_BASE_URL environment variable (dev only).
 * @returns The computed base URL.
 */
export function computeBaseURL(isProd: boolean, viteApiBaseUrl?: string): string {
  if (isProd) {
    // Production always uses PROD_API_PATH to ensure correct server configuration
    return PROD_API_PATH;
  }
  // Development allows override via VITE_API_BASE_URL
  return viteApiBaseUrl || PROD_API_PATH;
}

/**
 * Validates that the baseURL does not contain localhost in production.
 *
 * @param isProd - Whether the build is production.
 * @param baseURL - The base URL to validate.
 * @throws Error if production and baseURL contains localhost.
 */
export function validateBaseURL(isProd: boolean, baseURL: string): void {
  if (isProd && baseURL.includes('localhost')) {
    throw new Error(
      `[httpClient] FATAL: baseURL must not contain "localhost" in production! Current baseURL: ${baseURL}`
    );
  }
}

const baseURL = computeBaseURL(import.meta.env.PROD, import.meta.env.VITE_API_BASE_URL);
validateBaseURL(import.meta.env.PROD, baseURL);

const httpClient = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default httpClient;


httpClient.interceptors.request.use((config) => {
  if (config.data instanceof FormData) {
    if (config.headers && typeof config.headers === 'object') {
      delete config.headers['Content-Type'];
    }
  }
  return config;
});
