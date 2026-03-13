import type { AuthUser } from './types';

const API_BASE = import.meta.env.PROD
  ? '/openfarmplanner/api'
  : import.meta.env.VITE_API_BASE_URL || '/openfarmplanner/api';

function extractErrorMessage(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (typeof parsed.detail === 'string') {
      return parsed.detail;
    }

    return Object.entries(parsed)
      .map(([field, value]) => {
        if (Array.isArray(value)) {
          return `${field}: ${value.join(' ')}`;
        }
        return `${field}: ${String(value)}`;
      })
      .join(' | ');
  } catch {
    return raw || 'Request failed.';
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

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(extractErrorMessage(await response.text()));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export async function ensureCsrfCookie(): Promise<void> {
  await request<{ detail: string }>('/auth/csrf/', { method: 'GET' });
}

function csrfHeader(): Record<string, string> {
  return { 'X-CSRFToken': getCookie('csrftoken') ?? '' };
}

export function getMe(): Promise<AuthUser> {
  return request<AuthUser>('/auth/me/', { method: 'GET' });
}

export async function register(email: string, password: string, passwordConfirm: string, displayName = ''): Promise<{ detail: string }> {
  await ensureCsrfCookie();
  return request<{ detail: string }>('/auth/register/', {
    method: 'POST',
    headers: csrfHeader(),
    body: JSON.stringify({
      email,
      password,
      password_confirm: passwordConfirm,
      display_name: displayName,
    }),
  });
}

export async function activate(uid: string, token: string): Promise<AuthUser> {
  await ensureCsrfCookie();
  return request<AuthUser>('/auth/activate/', {
    method: 'POST',
    headers: csrfHeader(),
    body: JSON.stringify({ uid, token }),
  });
}

export async function login(email: string, password: string): Promise<AuthUser> {
  await ensureCsrfCookie();
  return request<AuthUser>('/auth/login/', {
    method: 'POST',
    headers: csrfHeader(),
    body: JSON.stringify({ email, password }),
  });
}

export async function logout(): Promise<void> {
  await ensureCsrfCookie();
  await request('/auth/logout/', { method: 'POST', headers: csrfHeader(), body: JSON.stringify({}) });
}

export async function resendActivation(email: string): Promise<{ detail: string }> {
  await ensureCsrfCookie();
  return request<{ detail: string }>('/auth/resend-activation/', {
    method: 'POST',
    headers: csrfHeader(),
    body: JSON.stringify({ email }),
  });
}

export async function requestPasswordReset(email: string): Promise<{ detail: string }> {
  await ensureCsrfCookie();
  return request<{ detail: string }>('/auth/password-reset/', {
    method: 'POST',
    headers: csrfHeader(),
    body: JSON.stringify({ email }),
  });
}

export async function confirmPasswordReset(uid: string, token: string, password: string, passwordConfirm: string): Promise<{ detail: string }> {
  await ensureCsrfCookie();
  return request<{ detail: string }>('/auth/password-reset-confirm/', {
    method: 'POST',
    headers: csrfHeader(),
    body: JSON.stringify({ uid, token, password, password_confirm: passwordConfirm }),
  });
}
