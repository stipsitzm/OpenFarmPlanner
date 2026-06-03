import type { MissingProjectReason } from "../../hooks/useProjectRequirement";
import { useTranslation } from "../../i18n";
import { openProjectCreationFlow } from "../../projects/projectCreationFlow";
import EmptyStateCard from "./EmptyStateCard";

interface ProjectRequiredStateProps {
  reason: MissingProjectReason;
}

export default function ProjectRequiredState({
  reason,
}: ProjectRequiredStateProps) {
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
    <EmptyStateCard
      title={t(titleKey)}
      description={t(descriptionKey)}
      actions={[
        isCreateFlow
          ? { label: t(actionLabelKey), onClick: openProjectCreationFlow }
          : { label: t(actionLabelKey), to: "/app/project-selection" },
      ]}
    />
  );
}
