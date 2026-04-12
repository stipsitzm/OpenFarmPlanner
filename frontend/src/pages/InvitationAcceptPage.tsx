import { Alert, Button, Container, Stack, Typography } from "@mui/material";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { projectAPI } from "../api/api";
import { useAuth } from "../auth/useAuth";
import { useTranslation } from "../i18n";
import {
  buildInvitationAcceptPath,
  clearInvitationRedirectStorage,
  getStoredInvitationToken,
  storeInvitationRedirect,
} from "./invitationAcceptance";

type AcceptStatus =
  | "loading"
  | "redirecting"
  | "success"
  | "info"
  | "error";

export default function InvitationAcceptPage(): React.ReactElement {
  const { t } = useTranslation("projectInvitations");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isLoading, switchActiveProject, refreshUser } = useAuth();
  const [status, setStatus] = useState<AcceptStatus>("loading");
  const [message, setMessage] = useState<string>("");
  const processedTokenRef = useRef<string | null>(null);
  const activeFlowIdRef = useRef(0);
  const hasTerminalStateRef = useRef(false);

  const token = useMemo(() => {
    const tokenFromQuery = searchParams.get("token");
    return tokenFromQuery?.trim() || getStoredInvitationToken();
  }, [searchParams]);

  useEffect(() => {
    if (hasTerminalStateRef.current) {
      return;
    }

    const flowId = activeFlowIdRef.current + 1;
    activeFlowIdRef.current = flowId;
    const isStaleFlow = (): boolean =>
      activeFlowIdRef.current !== flowId || hasTerminalStateRef.current;

    console.info("[InvitationAcceptPage] route reached", {
      path: window.location.pathname,
      search: window.location.search,
    });

    if (!token) {
      queueMicrotask(() => {
        setStatus("error");
        setMessage(t("result.invalid_token"));
      });
      return;
    }

    console.info("[InvitationAcceptPage] parsed token", { token });
    const nextPath = buildInvitationAcceptPath(token);
    storeInvitationRedirect(nextPath, token);

    if (isLoading) {
      queueMicrotask(() => {
        setStatus("loading");
        setMessage(t("acceptPage.accepting"));
      });
      return;
    }

    const acceptInvitation = async (): Promise<void> => {
      if (processedTokenRef.current === token) {
        return;
      }
      processedTokenRef.current = token;
      setStatus("loading");
      setMessage(t("acceptPage.accepting"));

      try {
        console.info("[InvitationAcceptPage] calling accept API", { token });
        const response = await projectAPI.acceptInvitationByToken(token);
        if (isStaleFlow()) {
          return;
        }
        const responseCode = response.data.code ?? "accepted";
        const projectId = response.data.project?.id ?? response.data.project_id;
        if (projectId) {
          window.localStorage.setItem("activeProjectId", String(projectId));
          await switchActiveProject(projectId);
          await refreshUser();
        }
        clearInvitationRedirectStorage();
        console.info(
          "[InvitationAcceptPage] invitation accepted successfully",
          { projectId, responseCode },
        );
        hasTerminalStateRef.current = true;
        setStatus("success");
        setMessage(
          responseCode === "already_member"
            ? t("result.already_member")
            : t("acceptPage.addedToProject"),
        );
        window.setTimeout(
          () => navigate("/app/locations", { replace: true }),
          1200,
        );
      } catch (acceptError: unknown) {
        if (isStaleFlow()) {
          return;
        }
        console.error(
          "[InvitationAcceptPage] invitation acceptance failed",
          acceptError,
        );
        const code =
          (acceptError as { response?: { data?: { code?: string } } })?.response
            ?.data?.code ?? "invalid_token";
        if (code === "already_member") {
          clearInvitationRedirectStorage();
          console.info("[InvitationAcceptPage] invitation already satisfied", {
            code,
          });
          hasTerminalStateRef.current = true;
          setStatus("success");
          setMessage(t(`result.${code}`));
          window.setTimeout(
            () => navigate("/app/locations", { replace: true }),
            1200,
          );
          return;
        }

        if (code === "accepted") {
          clearInvitationRedirectStorage();
          hasTerminalStateRef.current = true;
          setStatus("info");
          setMessage(t("result.accepted"));
          return;
        }

        if (
          code === "invalid_token" ||
          code === "expired" ||
          code === "revoked" ||
          code === "accepted"
        ) {
          clearInvitationRedirectStorage();
        }

        hasTerminalStateRef.current = true;
        setStatus("error");
        setMessage(
          t(`result.${code}`, { defaultValue: t("result.invalid_token") }),
        );
      }
    };

    const continueAnonymousFlow = async (): Promise<void> => {
      if (user) {
        void acceptInvitation();
        return;
      }

      try {
        const statusResponse = await projectAPI.getInvitationStatus(token);
        if (isStaleFlow()) {
          return;
        }
        if (statusResponse.data.code !== "pending") {
          clearInvitationRedirectStorage();
          hasTerminalStateRef.current = true;
          setStatus(statusResponse.data.code === "accepted" ? "info" : "error");
          setMessage(
            t(`result.${statusResponse.data.code}`, {
              defaultValue: t("result.invalid_token"),
            }),
          );
          return;
        }
      } catch (statusError: unknown) {
        if (isStaleFlow()) {
          return;
        }
        const code =
          (statusError as { response?: { data?: { code?: string } } })?.response
            ?.data?.code ?? "invalid_token";
        clearInvitationRedirectStorage();
        hasTerminalStateRef.current = true;
        setStatus("error");
        setMessage(t(`result.${code}`, { defaultValue: t("result.invalid_token") }));
        return;
      }

      setStatus("redirecting");
      console.info(
        "[InvitationAcceptPage] user not authenticated, redirecting to login",
        { nextPath },
      );
      navigate(`/login?next=${encodeURIComponent(nextPath)}`, {
        replace: true,
      });
    };

    void continueAnonymousFlow();
  }, [isLoading, navigate, refreshUser, switchActiveProject, t, token, user]);

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Stack spacing={2}>
        <Typography variant="h4">{t("acceptPage.title")}</Typography>
        {status === "loading" || status === "redirecting" ? (
          <Alert severity="info">
            {status === "redirecting"
              ? t("acceptPage.redirectingToLogin")
              : message || t("acceptPage.accepting")}
          </Alert>
        ) : null}
        {status === "success" ? (
          <Alert severity="success">{message}</Alert>
        ) : null}
        {status === "info" ? <Alert severity="info">{message}</Alert> : null}
        {status === "error" ? <Alert severity="error">{message}</Alert> : null}
        <Button
          variant="outlined"
          onClick={() => navigate("/app/locations", { replace: true })}
        >
          {t("openApp")}
        </Button>
      </Stack>
    </Container>
  );
}
