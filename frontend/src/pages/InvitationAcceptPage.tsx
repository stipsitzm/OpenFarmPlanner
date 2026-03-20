import { Alert, Button, Container, Stack, Typography } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { projectAPI } from "../api/api";
import { useAuth } from "../auth/AuthContext";
import { useTranslation } from "../i18n";
import {
  buildInvitationAcceptPath,
  clearInvitationRedirectStorage,
  getStoredInvitationToken,
  storeInvitationRedirect,
} from "./invitationAcceptance";

type AcceptStatus = "loading" | "redirecting" | "success" | "error";

export default function InvitationAcceptPage(): React.ReactElement {
  const { t } = useTranslation("projectInvitations");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isLoading, switchActiveProject, refreshUser } = useAuth();
  const [status, setStatus] = useState<AcceptStatus>("loading");
  const [message, setMessage] = useState<string>("");

  const token = useMemo(() => {
    const tokenFromQuery = searchParams.get("token");
    return tokenFromQuery?.trim() || getStoredInvitationToken();
  }, [searchParams]);

  useEffect(() => {
    console.info("[InvitationAcceptPage] route reached", {
      path: window.location.pathname,
      search: window.location.search,
    });

    if (!token) {
      setStatus("error");
      setMessage(t("result.invalid_token"));
      return;
    }

    console.info("[InvitationAcceptPage] parsed token", { token });
    const nextPath = buildInvitationAcceptPath(token);
    storeInvitationRedirect(nextPath, token);

    if (isLoading) {
      setStatus("loading");
      setMessage(t("acceptPage.accepting"));
      return;
    }

    if (!user) {
      setStatus("redirecting");
      console.info(
        "[InvitationAcceptPage] user not authenticated, redirecting to login",
        { nextPath },
      );
      navigate(`/login?next=${encodeURIComponent(nextPath)}`, {
        replace: true,
      });
      return;
    }

    let cancelled = false;

    const acceptInvitation = async (): Promise<void> => {
      setStatus("loading");
      setMessage(t("acceptPage.accepting"));

      try {
        console.info("[InvitationAcceptPage] calling accept API", { token });
        const response = await projectAPI.acceptInvitationByToken(token);
        const projectId = response.data.project?.id ?? response.data.project_id;
        if (projectId) {
          window.localStorage.setItem("activeProjectId", String(projectId));
          await switchActiveProject(projectId);
          await refreshUser();
        }
        clearInvitationRedirectStorage();
        if (cancelled) {
          return;
        }
        console.info(
          "[InvitationAcceptPage] invitation accepted successfully",
          { projectId },
        );
        setStatus("success");
        setMessage(t("acceptPage.addedToProject"));
        window.setTimeout(
          () => navigate("/app/anbauplaene", { replace: true }),
          1200,
        );
      } catch (acceptError: unknown) {
        if (cancelled) {
          return;
        }
        console.error(
          "[InvitationAcceptPage] invitation acceptance failed",
          acceptError,
        );
        const code =
          (acceptError as { response?: { data?: { code?: string } } })?.response
            ?.data?.code ?? "invalid_token";
        if (code === "already_member" || code === "accepted") {
          clearInvitationRedirectStorage();
          console.info("[InvitationAcceptPage] invitation already satisfied", {
            code,
          });
          setStatus("success");
          setMessage(t(`result.${code}`));
          window.setTimeout(
            () => navigate("/app/anbauplaene", { replace: true }),
            1200,
          );
          return;
        }

        if (
          code === "invalid_token" ||
          code === "expired" ||
          code === "revoked"
        ) {
          clearInvitationRedirectStorage();
        }

        setStatus("error");
        setMessage(
          t(`result.${code}`, { defaultValue: t("result.invalid_token") }),
        );
      }
    };

    void acceptInvitation();

    return () => {
      cancelled = true;
    };
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
        {status === "error" ? <Alert severity="error">{message}</Alert> : null}
        <Button
          variant="outlined"
          onClick={() => navigate("/app/anbauplaene", { replace: true })}
        >
          {t("openApp")}
        </Button>
      </Stack>
    </Container>
  );
}
