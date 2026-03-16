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
    return PROD_API_PATH;
  }
  return viteApiBaseUrl || PROD_API_PATH;
}

export function validateBaseURL(isProd: boolean, baseURL: string): void {
  if (isProd && baseURL.includes('localhost')) {
    throw new Error(
      `[httpClient] FATAL: baseURL must not contain "localhost" in production! Current baseURL: ${baseURL}`
    );
  }
}

function getCookie(name: string): string | null {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop()?.split(';').shift() ?? null;
  }
  return null;
}

const baseURL = computeBaseURL(import.meta.env.PROD, import.meta.env.VITE_API_BASE_URL);
validateBaseURL(import.meta.env.PROD, baseURL);

const httpClient = axios.create({
  baseURL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

httpClient.interceptors.request.use((config) => {
  if (config.data instanceof FormData) {
    if (config.headers && typeof config.headers === 'object') {
      delete config.headers['Content-Type'];
    }
  }

  const method = (config.method ?? 'get').toLowerCase();
  if (['post', 'put', 'patch', 'delete'].includes(method)) {
    const csrfToken = getCookie('csrftoken');
    if (csrfToken) {
      config.headers = config.headers ?? {};
      config.headers['X-CSRFToken'] = csrfToken;
    }
  }

  return config;
});

export default httpClient;
