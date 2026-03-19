import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  activate as activateRequest,
  getMe,
  login as loginRequest,
  logout as logoutRequest,
  register as registerRequest,
  resendActivation as resendActivationRequest,
  requestPasswordReset as requestPasswordResetRequest,
  confirmPasswordReset as confirmPasswordResetRequest,
  requestAccountDeletion as requestAccountDeletionRequest,
  restoreAccount as restoreAccountRequest,
  switchActiveProject as switchActiveProjectRequest,
} from './authApi';
import type { AuthUser } from './types';

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  activeProjectId: number | null;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  register: (email: string, password: string, passwordConfirm: string, displayName?: string) => Promise<string>;
  activate: (uid: string, token: string) => Promise<void>;
  resendActivation: (email: string) => Promise<string>;
  requestPasswordReset: (email: string) => Promise<string>;
  confirmPasswordReset: (uid: string, token: string, password: string, passwordConfirm: string) => Promise<string>;
  requestAccountDeletion: (password: string) => Promise<{ detail: string; scheduled_deletion_at: string }>;
  restoreAccount: (email: string, password: string) => Promise<AuthUser>;
  switchActiveProject: (projectId: number) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function clearStoredProjectId(): void {
  window.localStorage.removeItem('activeProjectId');
}

function applyResolvedProjectId(me: AuthUser): number | null {
  if (me.resolved_project_id) {
    window.localStorage.setItem('activeProjectId', String(me.resolved_project_id));
    return me.resolved_project_id;
  }
  clearStoredProjectId();
  return null;
}

function mergeProjectSelection(user: AuthUser, projectState: { resolved_project_id?: number | null; last_project_id?: number | null; default_project_id?: number | null }): AuthUser {
  return {
    ...user,
    resolved_project_id: projectState.resolved_project_id ?? null,
    last_project_id: projectState.last_project_id ?? null,
    default_project_id: projectState.default_project_id ?? null,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeProjectId, setActiveProjectId] = useState<number | null>(null);

  const applyAuthenticatedUser = (me: AuthUser): void => {
    setUser(me);
    setActiveProjectId(applyResolvedProjectId(me));
  };

  const clearAuthenticatedUser = (): void => {
    setUser(null);
    setActiveProjectId(null);
    clearStoredProjectId();
  };

  useEffect(() => {
    void (async () => {
      try {
        const me = await getMe();
        applyAuthenticatedUser(me);
      } catch {
        clearAuthenticatedUser();
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    isLoading,
    activeProjectId,
    login: async (email, password) => {
      const me = await loginRequest(email, password);
      applyAuthenticatedUser(me);
      return me;
    },
    logout: async () => {
      await logoutRequest();
      clearAuthenticatedUser();
    },
    register: async (email, password, passwordConfirm, displayName = '') => {
      const response = await registerRequest(email, password, passwordConfirm, displayName);
      return response.detail;
    },
    activate: async (uid, token) => {
      const me = await activateRequest(uid, token);
      applyAuthenticatedUser(me);
    },
    resendActivation: async (email) => {
      const response = await resendActivationRequest(email);
      return response.detail;
    },
    requestPasswordReset: async (email) => {
      const response = await requestPasswordResetRequest(email);
      return response.detail;
    },
    confirmPasswordReset: async (uid, token, password, passwordConfirm) => {
      const response = await confirmPasswordResetRequest(uid, token, password, passwordConfirm);
      return response.detail;
    },
    requestAccountDeletion: async (password) => {
      const response = await requestAccountDeletionRequest(password);
      clearAuthenticatedUser();
      return response;
    },
    restoreAccount: async (email, password) => {
      const me = await restoreAccountRequest(email, password);
      applyAuthenticatedUser(me);
      return me;
    },
    switchActiveProject: async (projectId: number) => {
      const switchResult = await switchActiveProjectRequest(projectId);
      const resolvedId = switchResult.resolved_project_id ?? projectId;
      window.localStorage.setItem('activeProjectId', String(resolvedId));
      setActiveProjectId(resolvedId);
      if (user) {
        setUser(mergeProjectSelection(user, switchResult));
      }
    },
  }), [activeProjectId, isLoading, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
