import { Box, Button, Tooltip, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import { useTranslation } from '../../i18n';

/**
 * Shared, compact expand/collapse-one-level toolbar control for hierarchical
 * Standort/Parzelle/Beet tree views (Anbauflächen, Anbaukalender). Desktop-only
 * by design — see the callers for why it's intentionally omitted on mobile.
 * Steps relative to the tree's current expansion state (see
 * useHierarchyLevelToggle) instead of exposing one button per absolute depth,
 * so it works the same way whether a project's hierarchy has 2 levels
 * (single-location projects) or 3+.
 *
 * Deliberately styled as a secondary, low-emphasis tool (muted "−"/"+"
 * buttons next to a plain "Hierarchie" label) rather than as a primary
 * action button like "Standort hinzufügen", and kept to two icon-only
 * buttons instead of a ButtonGroup so each can carry its own Tooltip
 * without fighting ButtonGroup's child-cloning/border logic.
 */
interface HierarchyLevelToggleProps {
  levelCount: number;
  canExpand: boolean;
  canCollapse: boolean;
  onExpandOneLevel: () => void;
  onCollapseOneLevel: () => void;
}

export function HierarchyLevelToggle({
  levelCount,
  canExpand,
  canCollapse,
  onExpandOneLevel,
  onCollapseOneLevel,
}: HierarchyLevelToggleProps) {
  const { t } = useTranslation('common');

  if (levelCount < 2) {
    return null;
  }

  const label = t('hierarchyLevelToggle.label');
  const expandTooltip = t('hierarchyLevelToggle.expandTooltip');
  const collapseTooltip = t('hierarchyLevelToggle.collapseTooltip');

  const buttonSx = {
    minWidth: 0,
    px: 0.75,
    py: 0.25,
    color: 'text.secondary',
    borderColor: 'divider',
    '&:hover': {
      borderColor: 'text.secondary',
      backgroundColor: 'action.hover',
    },
  };

  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
      <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
        {label}
      </Typography>
      <Box sx={{ display: 'inline-flex', gap: 0.5 }}>
        <Tooltip title={collapseTooltip}>
          <span>
            <Button
              size="small"
              variant="outlined"
              color="inherit"
              onClick={onCollapseOneLevel}
              disabled={!canCollapse}
              aria-label={collapseTooltip}
              sx={buttonSx}
            >
              <RemoveIcon fontSize="small" />
            </Button>
          </span>
        </Tooltip>
        <Tooltip title={expandTooltip}>
          <span>
            <Button
              size="small"
              variant="outlined"
              color="inherit"
              onClick={onExpandOneLevel}
              disabled={!canExpand}
              aria-label={expandTooltip}
              sx={buttonSx}
            >
              <AddIcon fontSize="small" />
            </Button>
          </span>
        </Tooltip>
      </Box>
    </Box>
  );
}
