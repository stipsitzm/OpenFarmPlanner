import { useEffect, useMemo, useState } from "react";
import {
  acceptConsent as acceptConsentRequest,
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
} from "./authApi";
import type { AuthUser } from "./types";
import { AuthContext, type AuthContextValue } from "./authContextShared";

function clearStoredProjectId(): void {
  window.localStorage.removeItem("activeProjectId");
}

function applyResolvedProjectId(me: AuthUser): number | null {
  if (me.resolved_project_id) {
    window.localStorage.setItem(
      "activeProjectId",
      String(me.resolved_project_id),
    );
    return me.resolved_project_id;
  }
  clearStoredProjectId();
  return null;
}

function mergeProjectSelection(
  user: AuthUser,
  projectState: {
    resolved_project_id?: number | null;
    last_project_id?: number | null;
    default_project_id?: number | null;
  },
): AuthUser {
  return {
    ...user,
    resolved_project_id: projectState.resolved_project_id ?? null,
    last_project_id: projectState.last_project_id ?? null,
    default_project_id: projectState.default_project_id ?? null,
  };
}

export function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeProjectId, setActiveProjectId] = useState<number | null>(null);

  const applyAuthenticatedUser = (me: AuthUser): void => {
    setUser(me);
    setActiveProjectId(applyResolvedProjectId(me));
  };

  const refreshUser = async (): Promise<AuthUser | null> => {
    try {
      const me = await getMe();
      applyAuthenticatedUser(me);
      return me;
    } catch {
      clearAuthenticatedUser();
      return null;
    }
  };

  const clearAuthenticatedUser = (): void => {
    setUser(null);
    setActiveProjectId(null);
    clearStoredProjectId();
  };

  useEffect(() => {
    void (async () => {
      try {
        await refreshUser();
      } catch {
        clearAuthenticatedUser();
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // localStorage is shared across tabs, but React state and the API's X-Project-Id
  // header (read fresh from localStorage per request, see httpClient.ts) are not: if
  // another tab switches the active project, this tab would keep showing stale data
  // while its own requests silently target the new project. Reload to resync.
  useEffect(() => {
    function handleStorageChange(event: StorageEvent): void {
      if (event.key !== "activeProjectId" || event.newValue === event.oldValue) {
        return;
      }
      window.location.reload();
    }
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
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
      register: async (email, password, passwordConfirm, displayName = "", acceptTerms = false) => {
        const response = await registerRequest(
          email,
          password,
          passwordConfirm,
          displayName,
          acceptTerms,
        );
        return response.detail;
      },
      acceptConsent: async (document) => {
        const me = await acceptConsentRequest(document);
        applyAuthenticatedUser(me);
        return me;
      },
      activate: async (uid, token) => {
        const me = await activateRequest(uid, token);
        applyAuthenticatedUser(me);
        return me;
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
        const response = await confirmPasswordResetRequest(
          uid,
          token,
          password,
          passwordConfirm,
        );
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
        window.localStorage.setItem("activeProjectId", String(resolvedId));
        setActiveProjectId(resolvedId);
        const refreshed = await refreshUser();
        if (!refreshed && user) {
          setUser(mergeProjectSelection(user, switchResult));
        }
      },
      refreshUser,
    }),
    [activeProjectId, isLoading, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
