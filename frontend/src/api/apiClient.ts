import axios from 'axios';

// Compute baseURL depending on environment
let baseURL: string;

if (import.meta.env.PROD) {
  // Production: always use relative API path
  baseURL = '/openfarmplanner/api';
} else {
  // Development: allow override, fallback to relative path
  baseURL = import.meta.env.VITE_API_BASE_URL ?? '/openfarmplanner/api';
}

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
