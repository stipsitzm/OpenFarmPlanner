interface ErrorResponseDetails {
  status?: unknown;
  statusText?: unknown;
  data?: unknown;
  headers?: unknown;
}

export interface RuntimeErrorDetails {
  name: string;
  message: string;
  stack?: string;
  componentStack?: string;
  apiDetails?: {
    code?: unknown;
    method?: unknown;
    url?: unknown;
    response?: ErrorResponseDetails;
  };
  errorId?: string;
}

const ERROR_ID_KEYS = [
  'error_id',
  'errorId',
  'request_id',
  'requestId',
  'trace_id',
  'traceId',
  'correlation_id',
  'correlationId',
] as const;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object'
    ? value as Record<string, unknown>
    : null;
}

function readErrorId(value: unknown): string | undefined {
  const record = asRecord(value);
  if (!record) {
    return undefined;
  }

  for (const key of ERROR_ID_KEYS) {
    const candidate = record[key];
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  return undefined;
}

function readHeaderErrorId(headers: unknown): string | undefined {
  const record = asRecord(headers);
  if (!record) {
    return undefined;
  }

  for (const key of ['x-error-id', 'x-request-id', 'x-trace-id', 'x-correlation-id']) {
    const getHeader = record.get;
    if (typeof getHeader === 'function') {
      const candidate = getHeader.call(headers, key);
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate.trim();
      }
    }
    const candidate = record[key];
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  return undefined;
}

export function getRuntimeErrorDetails(
  error: unknown,
  componentStack?: string,
): RuntimeErrorDetails {
  const errorRecord = asRecord(error);
  const response = asRecord(errorRecord?.response);
  const config = asRecord(errorRecord?.config);
  const responseData = response?.data;
  const responseHeaders = response?.headers;
  const directData = errorRecord?.data;
  const directStatus = errorRecord?.status;
  const directStatusText = errorRecord?.statusText;

  const name = error instanceof Error
    ? error.name
    : typeof errorRecord?.name === 'string'
      ? errorRecord.name
      : 'Unknown Error';
  const message = error instanceof Error
    ? error.message
    : typeof errorRecord?.message === 'string'
      ? errorRecord.message
      : String(error);

  const hasApiDetails = Boolean(
    response ||
    directStatus ||
    directData ||
    errorRecord?.code ||
    config?.method ||
    config?.url,
  );

  return {
    name,
    message,
    stack: error instanceof Error
      ? error.stack
      : typeof errorRecord?.stack === 'string'
        ? errorRecord.stack
        : undefined,
    componentStack: componentStack?.trim() || undefined,
    apiDetails: hasApiDetails
      ? {
          code: errorRecord?.code,
          method: config?.method,
          url: config?.url,
          response: response
            ? {
                status: response.status,
                statusText: response.statusText,
                data: responseData,
                headers: responseHeaders,
              }
            : directStatus || directData
              ? {
                  status: directStatus,
                  statusText: directStatusText,
                  data: directData,
                }
            : undefined,
        }
      : undefined,
    errorId:
      readErrorId(responseData) ??
      readErrorId(directData) ??
      readErrorId(error) ??
      readHeaderErrorId(responseHeaders),
  };
}

export function stringifyErrorDetails(value: unknown): string {
  const seen = new WeakSet<object>();

  try {
    return JSON.stringify(
      value,
      (_key, nestedValue: unknown) => {
        if (nestedValue && typeof nestedValue === 'object') {
          if (seen.has(nestedValue)) {
            return '[Circular]';
          }
          seen.add(nestedValue);
        }
        return nestedValue;
      },
      2,
    );
  } catch {
    return String(value);
  }
}
