import { Alert, Box, Button, Stack, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
import type { MissingProjectReason } from "../../hooks/useProjectRequirement";
import { useTranslation } from "../../i18n";
import { openProjectCreationFlow } from "../../projects/projectCreationFlow";

interface ProjectRequiredStateProps {
  reason: MissingProjectReason;
}

export default function ProjectRequiredState({
  reason,
}: ProjectRequiredStateProps): React.ReactElement {
  const navigate = useNavigate();
  const { t } = useTranslation("common");

  const isCreateFlow = reason === "no_projects";
  const titleKey = isCreateFlow
    ? "projectRequired.noProjectsTitle"
    : "projectRequired.noActiveProjectTitle";
  const descriptionKey = isCreateFlow
    ? "projectRequired.noProjectsDescription"
    : "projectRequired.noActiveProjectDescription";
  const actionLabelKey = isCreateFlow
    ? "projectRequired.createProjectAction"
    : "projectRequired.selectProjectAction";

  return (
    <Alert severity="info">
      <Stack spacing={1.5}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          {t(titleKey)}
        </Typography>
        <Typography variant="body2">{t(descriptionKey)}</Typography>
        <Box>
          <Button
            variant="contained"
            onClick={() => {
              if (isCreateFlow) {
                openProjectCreationFlow();
                return;
              }
              navigate("/app/project-selection");
            }}
          >
            {t(actionLabelKey)}
          </Button>
        </Box>
      </Stack>
    </Alert>
  );
}
