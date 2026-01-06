import axios from 'axios';

// Compute baseURL depending on environment
const DEFAULT_API_PATH = '/openfarmplanner/api';
const DEV_API_PATH = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api';

let baseURL: string = import.meta.env.PROD ? DEFAULT_API_PATH : DEV_API_PATH;

// Runtime guard: prevent localhost in production
if (import.meta.env.PROD && baseURL.includes('localhost')) {
  throw new Error(
    '[apiClient] FATAL: baseURL must not contain "localhost" in production! Current baseURL: ' + baseURL
  );
}

const apiClient = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default apiClient;
