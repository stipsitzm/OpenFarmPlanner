import axios from 'axios';

// Compute baseURL depending on environment
const PROD_API_PATH = '/openfarmplanner/api';
const DEV_API_PATH = import.meta.env.VITE_API_BASE_URL ?? PROD_API_PATH;

const baseURL: string = import.meta.env.PROD ? PROD_API_PATH : DEV_API_PATH;

// Runtime guard: prevent localhost in production
if (import.meta.env.PROD && baseURL.includes('localhost')) {
  throw new Error(
    '[httpClient] FATAL: baseURL must not contain "localhost" in production! Current baseURL: ' + baseURL
  );
}

const httpClient = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default httpClient;
