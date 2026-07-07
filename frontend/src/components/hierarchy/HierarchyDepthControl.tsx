import { ButtonGroup, Button, Box, Typography } from '@mui/material';
import { segmentedButtonGroupSx, getSegmentedActionButtonSx } from '../buttons/segmentedControlStyles';
import { useTranslation } from '../../i18n';

/**
 * Shared, compact "Tiefe: 1 2 3" control for hierarchical Standort/Parzelle/
 * Beet tree views (Anbauflächen, Anbaukalender). Desktop-only by design —
 * see the callers for why it's intentionally omitted on mobile. Offers
 * exactly as many levels as the tree actually has (see useHierarchyDepthControl
 * / getTreeLevelCount) rather than assuming a fixed depth, so single-location
 * projects (whose tree omits the Standort level) get a 2-level control.
 */
interface HierarchyDepthControlProps {
  levelCount: number;
  activeLevel: number | null;
  onSelectLevel: (level: number) => void;
  /** aria-label for level N (1-based), describing what selecting it reveals. */
  getLevelAriaLabel: (level: number) => string;
}

export function HierarchyDepthControl({
  levelCount,
  activeLevel,
  onSelectLevel,
  getLevelAriaLabel,
}: HierarchyDepthControlProps) {
  const { t } = useTranslation('common');

  if (levelCount < 2) {
    return null;
  }

  const levels = Array.from({ length: levelCount }, (_, index) => index + 1);

  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, flexShrink: 0 }}>
      <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
        {t('treeDepth.label')}
      </Typography>
      <ButtonGroup
        size="small"
        variant="outlined"
        aria-label={t('treeDepth.groupAriaLabel')}
        sx={segmentedButtonGroupSx}
      >
        {levels.map((level) => {
          const active = activeLevel === level;
          return (
            <Button
              key={level}
              onClick={() => onSelectLevel(level)}
              aria-pressed={active}
              aria-label={getLevelAriaLabel(level)}
              variant={active ? 'contained' : 'outlined'}
              color={active ? 'success' : 'inherit'}
              sx={{ ...getSegmentedActionButtonSx({ active }), minWidth: 32, px: 0 }}
            >
              {level}
            </Button>
          );
        })}
      </ButtonGroup>
    </Box>
  );
}
