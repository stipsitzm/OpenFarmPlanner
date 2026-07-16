import { Divider, Menu } from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteIcon from "@mui/icons-material/Delete";

import { useTranslation } from "../../i18n";
import { ContextMenuActionItem } from "../contextMenu/ContextMenuActionItem";
import type { PlantingPlanRow } from "../../pages/plantingPlansUtils";

interface MobilePlanActionsMenuProps {
  anchorEl: HTMLElement | null;
  /** The row the menu was opened for; actions are no-ops while it is null. */
  row: PlantingPlanRow | null;
  onClose: () => void;
  onEdit: (row: PlantingPlanRow) => void;
  onDuplicate: (row: PlantingPlanRow) => void;
  onCopy: (row: PlantingPlanRow) => void;
  onDelete: (row: PlantingPlanRow) => void;
}

/**
 * Presentational per-card actions menu for the mobile planting-plan list.
 * Anchor/row state and the action handlers live in PlantingPlans.tsx; every
 * item closes the menu after delegating, matching the original inline JSX.
 */
export function MobilePlanActionsMenu({
  anchorEl,
  row,
  onClose,
  onEdit,
  onDuplicate,
  onCopy,
  onDelete,
}: MobilePlanActionsMenuProps) {
  const { t } = useTranslation(["plantingPlans", "common"]);

  return (
    <Menu
      id="planting-plan-mobile-actions-menu"
      anchorEl={anchorEl}
      open={Boolean(anchorEl)}
      onClose={onClose}
    >
      <ContextMenuActionItem
        label={t("common:actions.edit")}
        icon={<EditIcon fontSize="small" />}
        onClick={() => {
          if (row) {
            onEdit(row);
          }
          onClose();
        }}
      />
      <ContextMenuActionItem
        label={t("common:actions.duplicate")}
        icon={<ContentCopyIcon fontSize="small" />}
        onClick={() => {
          if (row) {
            onDuplicate(row);
          }
          onClose();
        }}
      />
      <ContextMenuActionItem
        label={t("plantingPlans:actions.copyPlantingPlan")}
        icon={<ContentCopyIcon fontSize="small" />}
        onClick={() => {
          if (row) {
            onCopy(row);
          }
          onClose();
        }}
      />
      <Divider role="separator" />
      <ContextMenuActionItem
        label={t("common:actions.delete")}
        icon={<DeleteIcon fontSize="small" />}
        color="error"
        onClick={() => {
          if (row) {
            onDelete(row);
          }
          onClose();
        }}
      />
    </Menu>
  );
}
