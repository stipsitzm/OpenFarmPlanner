const INVITATION_NEXT_STORAGE_KEY = 'ofp.invitationAcceptNext';
const INVITATION_TOKEN_STORAGE_KEY = 'ofp.invitationAcceptToken';

export function sanitizeNextPath(next: string | null | undefined): string | null {
  if (!next || !next.startsWith('/') || next.startsWith('//')) {
    return null;
  }

  return next;
}

export function buildInvitationAcceptPath(token: string): string {
  return `/invite/accept?token=${encodeURIComponent(token)}`;
}

export function getNextFromSearch(search: string): string | null {
  return sanitizeNextPath(new URLSearchParams(search).get('next'));
}

export function getTokenFromSearch(search: string): string | null {
  const token = new URLSearchParams(search).get('token');
  return token && token.trim() ? token.trim() : null;
}

export function getTokenFromNextPath(nextPath: string | null): string | null {
  if (!nextPath) {
    return null;
  }

  const [pathname, search = ''] = nextPath.split('?', 2);
  if (pathname !== '/invite/accept') {
    return null;
  }

  return getTokenFromSearch(search);
}

export function storeInvitationRedirect(nextPath: string, token?: string | null): void {
  window.localStorage.setItem(INVITATION_NEXT_STORAGE_KEY, nextPath);
  if (token) {
    window.localStorage.setItem(INVITATION_TOKEN_STORAGE_KEY, token);
  }
}

export function getStoredInvitationNext(): string | null {
  return sanitizeNextPath(window.localStorage.getItem(INVITATION_NEXT_STORAGE_KEY));
}

export function getStoredInvitationToken(): string | null {
  const token = window.localStorage.getItem(INVITATION_TOKEN_STORAGE_KEY);
  return token && token.trim() ? token.trim() : null;
}

export function clearInvitationRedirectStorage(): void {
  window.localStorage.removeItem(INVITATION_NEXT_STORAGE_KEY);
  window.localStorage.removeItem(INVITATION_TOKEN_STORAGE_KEY);
}
