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
} from './authApi';
import type { AuthUser } from './types';

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (email: string, password: string, passwordConfirm: string, displayName?: string) => Promise<string>;
  activate: (uid: string, token: string) => Promise<void>;
  resendActivation: (email: string) => Promise<string>;
  requestPasswordReset: (email: string) => Promise<string>;
  confirmPasswordReset: (uid: string, token: string, password: string, passwordConfirm: string) => Promise<string>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        setUser(await getMe());
      } catch {
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    isLoading,
    login: async (email, password) => {
      setUser(await loginRequest(email, password));
    },
    logout: async () => {
      await logoutRequest();
      setUser(null);
    },
    register: async (email, password, passwordConfirm, displayName = '') => {
      const response = await registerRequest(email, password, passwordConfirm, displayName);
      return response.detail;
    },
    activate: async (uid, token) => {
      setUser(await activateRequest(uid, token));
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
  }), [isLoading, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
