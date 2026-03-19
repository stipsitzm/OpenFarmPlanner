import type { AccountDeleteResponse, AuthUser, ProjectSwitchResponse } from './types';

const API_BASE = import.meta.env.PROD
  ? '/openfarmplanner/api'
  : import.meta.env.VITE_API_BASE_URL || '/openfarmplanner/api';

export class AuthApiError extends Error {
  code?: string;
  scheduledDeletionAt?: string;

  constructor(message: string, code?: string, scheduledDeletionAt?: string) {
    super(message);
    this.code = code;
    this.scheduledDeletionAt = scheduledDeletionAt;
  }
}

function extractError(raw: string): AuthApiError {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const detail = typeof parsed.detail === 'string'
      ? parsed.detail
      : Object.entries(parsed).map(([field, value]) => `${field}: ${String(value)}`).join(' | ');
    const code = typeof parsed.code === 'string' ? parsed.code : undefined;
    const scheduledDeletionAt = typeof parsed.scheduled_deletion_at === 'string' ? parsed.scheduled_deletion_at : undefined;
    return new AuthApiError(detail || 'Request failed.', code, scheduledDeletionAt);
  } catch {
    return new AuthApiError(raw || 'Request failed.');
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
    throw extractError(await response.text());
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

export async function requestAccountDeletion(password: string): Promise<AccountDeleteResponse> {
  await ensureCsrfCookie();
  return request<AccountDeleteResponse>('/auth/account/delete-request/', {
    method: 'POST',
    headers: csrfHeader(),
    body: JSON.stringify({ password }),
  });
}

export async function restoreAccount(email: string, password: string): Promise<AuthUser> {
  await ensureCsrfCookie();
  return request<AuthUser>('/auth/account/restore/', {
    method: 'POST',
    headers: csrfHeader(),
    body: JSON.stringify({ email, password }),
  });
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

export async function switchActiveProject(projectId: number): Promise<ProjectSwitchResponse> {
  await ensureCsrfCookie();
  return request<ProjectSwitchResponse>('/projects-switch/', {
    method: 'POST',
    headers: csrfHeader(),
    body: JSON.stringify({ project_id: projectId }),
  });
}
