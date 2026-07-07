import { useState } from 'react';
import {
  Box,
  Button,
  Menu,
  MenuItem,
  ListItemText,
  Tooltip,
} from '@mui/material';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import { useTranslation } from '../../i18n';

/**
 * Shared "Ansicht" control for hierarchical Standort/Parzelle/Beet tree
 * views (Anbauflächen, Anbaukalender). Desktop-only by design — see the
 * callers for why it's intentionally omitted on mobile.
 */
export type HierarchyViewLevel = 'locations' | 'locationsAndFields' | 'all' | 'collapsed';

const LEVEL_ORDER: HierarchyViewLevel[] = ['locations', 'locationsAndFields', 'all', 'collapsed'];

interface HierarchyViewLevelMenuProps {
  onSelectLevel: (level: HierarchyViewLevel) => void;
}

export function HierarchyViewLevelMenu({ onSelectLevel }: HierarchyViewLevelMenuProps) {
  const { t } = useTranslation('common');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const isOpen = Boolean(anchorEl);
  const handleClose = (): void => setAnchorEl(null);

  const handleSelect = (level: HierarchyViewLevel): void => {
    onSelectLevel(level);
    handleClose();
  };

  return (
    <>
      <Box sx={{ display: 'inline-flex', flexShrink: 0 }}>
        <Tooltip title={t('treeView.buttonTooltip')}>
          <Button
            size="small"
            variant="outlined"
            color="secondary"
            startIcon={<AccountTreeOutlinedIcon fontSize="small" />}
            onClick={(e) => setAnchorEl(e.currentTarget)}
            aria-label={t('treeView.buttonTooltip')}
            aria-haspopup="true"
            aria-expanded={isOpen}
            sx={{ textTransform: 'none', flexShrink: 0, whiteSpace: 'nowrap', px: 1.25, bgcolor: 'background.paper' }}
          >
            {t('treeView.button')}
          </Button>
        </Tooltip>
      </Box>

      <Menu anchorEl={anchorEl} open={isOpen} onClose={handleClose}>
        {LEVEL_ORDER.map((level) => (
          <MenuItem key={level} dense onClick={() => handleSelect(level)}>
            <ListItemText
              primary={t(`treeView.${level}`)}
              primaryTypographyProps={{ variant: 'body2' }}
            />
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
