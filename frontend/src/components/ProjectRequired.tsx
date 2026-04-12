import AddIcon from "@mui/icons-material/Add";
import { Box, Button, Paper, Stack, Typography } from "@mui/material";
import type { PropsWithChildren } from "react";
import { useMemo } from "react";
import { useTranslation } from "../i18n";
import { useAuth } from "../auth/useAuth";

const OPEN_CREATE_PROJECT_EVENT = "ofp:open-create-project";

const hasAccessibleActiveProject = (
  activeProjectId: number | null,
  memberships: { project_id: number }[],
): boolean => {
  if (activeProjectId === null) {
    return false;
  }

  return memberships.some((membership) => membership.project_id === activeProjectId);
};

export default function ProjectRequired(
  props: PropsWithChildren,
): React.ReactElement {
  const { children } = props;
  const { t } = useTranslation("navigation");
  const { activeProjectId, user } = useAuth();

  const memberships = useMemo(() => user?.memberships ?? [], [user?.memberships]);
  const projectAvailable = hasAccessibleActiveProject(activeProjectId, memberships);

  if (projectAvailable) {
    return <>{children}</>;
  }

  return (
    <Box sx={{ px: 2, py: { xs: 4, md: 6 } }}>
      <Paper
        elevation={0}
        sx={{
          mx: "auto",
          maxWidth: 720,
          borderRadius: 3,
          border: "1px solid",
          borderColor: "divider",
          p: { xs: 3, md: 5 },
          textAlign: "center",
          backgroundColor: "background.paper",
        }}
      >
        <Stack spacing={2} alignItems="center">
          <Typography variant="h5">
            {t("projectRequired.title")}
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 540 }}>
            {t("projectRequired.description")}
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() =>
              window.dispatchEvent(new CustomEvent(OPEN_CREATE_PROJECT_EVENT))
            }
          >
            {t("projectRequired.createAction")}
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}

export { OPEN_CREATE_PROJECT_EVENT };
