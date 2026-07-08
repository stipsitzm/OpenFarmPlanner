import { Box, IconButton, Tooltip } from '@mui/material';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess';
import { useTranslation } from '../../i18n';

/**
 * Shared, compact expand/collapse-one-level toolbar toggle for hierarchical
 * Standort/Parzelle/Beet tree views (Anbauflächen, Anbaukalender). Desktop-only
 * by design — see the callers for why it's intentionally omitted on mobile.
 * Steps relative to the tree's current expansion state (see
 * useHierarchyLevelToggle) instead of exposing one button per absolute depth,
 * so it works the same way whether a project's hierarchy has 2 levels
 * (single-location projects) or 3+.
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

  const expandLabel = t('hierarchyLevelToggle.expandTooltip');
  const collapseLabel = t('hierarchyLevelToggle.collapseTooltip');

  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
      <Tooltip title={expandLabel}>
        <span>
          <IconButton
            size="small"
            onClick={onExpandOneLevel}
            disabled={!canExpand}
            aria-label={expandLabel}
          >
            <UnfoldMoreIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title={collapseLabel}>
        <span>
          <IconButton
            size="small"
            onClick={onCollapseOneLevel}
            disabled={!canCollapse}
            aria-label={collapseLabel}
          >
            <UnfoldLessIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
    </Box>
  );
}
