const CHUNK_RELOAD_STORAGE_KEY = 'openFarmPlanner.lastChunkReloadAt';
const CHUNK_RELOAD_WINDOW_MS = 60_000;

const DYNAMIC_IMPORT_ERROR_PATTERNS = [
  'failed to fetch dynamically imported module',
  'importing a module script failed',
  'error loading dynamically imported module',
  'chunkloaderror',
  'loading chunk',
  'loading css chunk',
  'unable to preload css',
  'vite:preloaderror',
];

function getErrorText(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name} ${error.message}`.toLowerCase();
  }

  if (typeof error === 'string') {
    return error.toLowerCase();
  }

  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    const parts = [record.name, record.message, record.type, record.reason, record.payload]
      .filter((value): value is string => typeof value === 'string');
    return parts.join(' ').toLowerCase();
  }

  return '';
}

function getSessionStorage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function isDynamicImportLoadError(error: unknown): boolean {
  const errorText = getErrorText(error);
  return DYNAMIC_IMPORT_ERROR_PATTERNS.some((pattern) => errorText.includes(pattern));
}

export function shouldAutomaticallyReloadForChunkError(now = Date.now()): boolean {
  const storage = getSessionStorage();
  if (!storage) {
    return false;
  }

  const previousReloadAt = Number(storage.getItem(CHUNK_RELOAD_STORAGE_KEY));
  if (Number.isFinite(previousReloadAt) && now - previousReloadAt < CHUNK_RELOAD_WINDOW_MS) {
    return false;
  }

  storage.setItem(CHUNK_RELOAD_STORAGE_KEY, String(now));
  return true;
}

export function reloadPage(): void {
  window.location.reload();
}

export function reloadOnceForDynamicImportError(error: unknown): boolean {
  if (!isDynamicImportLoadError(error) || !shouldAutomaticallyReloadForChunkError()) {
    return false;
  }

  reloadPage();
  return true;
}
