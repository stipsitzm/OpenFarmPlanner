import type { AuthUser } from './types';

const API_BASE = import.meta.env.PROD
  ? '/openfarmplanner/api'
  : import.meta.env.VITE_API_BASE_URL || '/openfarmplanner/api';

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
    throw new Error(await response.text());
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export async function ensureCsrfCookie(): Promise<void> {
  await request<{ detail: string }>('/auth/csrf/', { method: 'GET' });
}

export async function getMe(): Promise<AuthUser> {
  return request<AuthUser>('/auth/me/', { method: 'GET' });
}

export async function login(username: string, password: string): Promise<AuthUser> {
  await ensureCsrfCookie();
  const csrfToken = getCookie('csrftoken') ?? '';
  return request<AuthUser>('/auth/login/', {
    method: 'POST',
    headers: { 'X-CSRFToken': csrfToken },
    body: JSON.stringify({ username, password }),
  });
}

export async function logout(): Promise<void> {
  await ensureCsrfCookie();
  const csrfToken = getCookie('csrftoken') ?? '';
  await request<{ detail: string }>('/auth/logout/', {
    method: 'POST',
    headers: { 'X-CSRFToken': csrfToken },
    body: JSON.stringify({}),
  });
}


export async function register(username: string, password: string, passwordConfirm: string, email = ''): Promise<AuthUser> {
  await ensureCsrfCookie();
  const csrfToken = getCookie('csrftoken') ?? '';
  return request<AuthUser>('/auth/register/', {
    method: 'POST',
    headers: { 'X-CSRFToken': csrfToken },
    body: JSON.stringify({
      username,
      password,
      password_confirm: passwordConfirm,
      email,
    }),
  });
}
